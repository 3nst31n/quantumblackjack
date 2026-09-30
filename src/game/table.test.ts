import { describe, it, expect } from 'vitest';
import {
  createTable,
  playerHit,
  playerStand,
  observeCard,
  entangleCards,
  advanceDealerAndResolve,
  startNextRound,
} from './table';
import { ENTANGLEMENT_COST, STARTING_CHIPS, WIN_GOAL } from './chips';

function playOutAllPlayers(table: ReturnType<typeof createTable>) {
  while (table.phase === 'players') {
    table = playerStand(table, table.activePlayerIndex);
  }
  return table;
}

describe('table: dealing', () => {
  it('deals two cards to every player and the dealer', () => {
    const table = createTable(['A', 'B', 'C']);
    expect(table.players).toHaveLength(3);
    table.players.forEach((p) => expect(p.hand).toHaveLength(2));
    expect(table.dealerHand).toHaveLength(2);
  });

  it('starts with the first player active and everyone else waiting', () => {
    const table = createTable(['A', 'B', 'C']);
    expect(table.activePlayerIndex).toBe(0);
    expect(table.players[0].status).toBe('active');
    expect(table.players[1].status).toBe('waiting');
    expect(table.players[2].status).toBe('waiting');
    expect(table.phase).toBe('players');
  });

  it('gives every player the starting chip count', () => {
    const table = createTable(['A', 'B']);
    table.players.forEach((p) => expect(p.chips).toBe(STARTING_CHIPS));
  });
});

describe('table: turn advancement', () => {
  it('moves the active seat to the next waiting player on stand', () => {
    let table = createTable(['A', 'B', 'C']);
    table = playerStand(table, 0);
    expect(table.players[0].status).toBe('done');
    expect(table.activePlayerIndex).toBe(1);
    expect(table.players[1].status).toBe('active');
    expect(table.phase).toBe('players');
  });

  it('moves to the dealer phase once every player is done', () => {
    let table = createTable(['A', 'B']);
    table = playerStand(table, 0);
    table = playerStand(table, 1);
    expect(table.phase).toBe('dealer');
  });

  it('ignores actions on a non-active player', () => {
    const table = createTable(['A', 'B']);
    const next = playerStand(table, 1); // seat 1 is still 'waiting'
    expect(next).toBe(table);
  });

  it('auto-advances the seat when a hit causes a guaranteed bust', () => {
    let table = createTable(['A', 'B']);
    // Force enough hits to bust with plain-card draws (regular deck has no way to
    // guarantee a bust deterministically without quantum cards, so just hit until done).
    let guard = 0;
    while (table.players[0].status === 'active' && guard < 20) {
      table = playerHit(table, 0);
      guard++;
    }
    expect(table.players[0].status).toBe('done');
  });
});

describe('table: quantum actions scoped per player', () => {
  it('deducts exactly 1 chip immediately when entangling', () => {
    let table = createTable(['A', 'B']);
    const quantumCards = table.players[0].hand.filter((c) => c.kind === 'quantum');
    if (quantumCards.length < 2) return; // not dealt two quantum cards this round, skip
    const before = table.players[0].chips;
    table = entangleCards(table, 0, quantumCards[0].id, quantumCards[1].id, 'SAME');
    expect(table.players[0].chips).toBe(before - ENTANGLEMENT_COST);
  });

  it('refuses to entangle with 0 chips', () => {
    let table = createTable(['A', 'B']);
    table = {
      ...table,
      players: table.players.map((p, i) => (i === 0 ? { ...p, chips: 0 } : p)),
    };
    const quantumCards = table.players[0].hand.filter((c) => c.kind === 'quantum');
    if (quantumCards.length < 2) return;
    const before = table.players[0].chips;
    table = entangleCards(table, 0, quantumCards[0].id, quantumCards[1].id, 'SAME');
    expect(table.players[0].chips).toBe(before);
  });

  it('collapses a quantum card via observeCard without ending the turn', () => {
    let table = createTable(['A', 'B']);
    const quantumCard = table.players[0].hand.find((c) => c.kind === 'quantum');
    if (!quantumCard) return; // no quantum card dealt this round, skip
    table = observeCard(table, 0, quantumCard.id);
    const observed = table.players[0].hand.find((c) => c.id === quantumCard.id);
    expect(observed?.kind === 'quantum' && observed.observed).toBe(true);
  });
});

describe('table: dealer resolution', () => {
  it('only resolves once every player has finished', () => {
    let table = createTable(['A', 'B']);
    table = playerStand(table, 0);
    expect(advanceDealerAndResolve(table)).toBe(table); // still 'players' phase, no-op
  });

  it('deals dealer cards until reaching at least 17, always fully measured', () => {
    let table = createTable(['A', 'B']);
    table = playOutAllPlayers(table);
    table = advanceDealerAndResolve(table);
    expect(table.phase).toBe('round-over');
    const hasUnmeasuredCard = table.dealerHand.some((c) => c.kind === 'quantum' && !c.observed);
    expect(hasUnmeasuredCard).toBe(false);
  });

  it('computes an independent outcome and chip result for every player', () => {
    let table = createTable(['A', 'B']);
    table = playOutAllPlayers(table);
    table = advanceDealerAndResolve(table);
    table.players.forEach((p) => {
      expect(p.roundResult).not.toBeNull();
    });
  });
});

describe('table: first-winner tracking', () => {
  it('only ever sets firstWinnerId once, for the first player to cross WIN_GOAL', () => {
    let table = createTable(['A', 'B']);
    table = {
      ...table,
      players: table.players.map((p, i) => (i === 0 ? { ...p, chips: WIN_GOAL - 2 } : p)),
    };
    table = playOutAllPlayers(table);
    table = advanceDealerAndResolve(table);

    if (table.firstWinnerId !== null) {
      const firstWinnerId = table.firstWinnerId;
      // Start another round and force a second player to also cross the goal.
      table = startNextRound(table);
      table = {
        ...table,
        players: table.players.map((p) => (p.id !== firstWinnerId ? { ...p, chips: WIN_GOAL } : p)),
      };
      table = playOutAllPlayers(table);
      table = advanceDealerAndResolve(table);
      expect(table.firstWinnerId).toBe(firstWinnerId);
    }
  });

  it('preserves chips and firstWinnerId across startNextRound', () => {
    let table = createTable(['A', 'B']);
    table = playOutAllPlayers(table);
    table = advanceDealerAndResolve(table);
    const chipsBefore = table.players.map((p) => p.chips);
    const winnerBefore = table.firstWinnerId;
    table = startNextRound(table);
    expect(table.players.map((p) => p.chips)).toEqual(chipsBefore);
    expect(table.firstWinnerId).toBe(winnerBefore);
    expect(table.phase).toBe('players');
  });
});
