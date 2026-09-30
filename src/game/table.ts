// Multiplayer table orchestration: one shared dealer hand, independent per-player
// hands/chips, turn order advancing seat by seat. Replaces the old single-player
// engine.ts. Hand-level rules (cards, deck, blackjack math, quantum, chip rewards)
// are untouched and reused here.

import type { Card } from './cards';
import { createGameDeck, drawCard } from './deck';
import { computeHandValue, computeHandRange, isBust } from './blackjack';
import type { Entanglement, EntanglementMode } from './quantum';
import { canEntangle, createEntanglement, observeQuantumCard, resolveAllUnobserved } from './quantum';
import { determineOutcome, WIN_GOAL, ENTANGLEMENT_COST, STARTING_CHIPS } from './chips';

export type PlayerStatus = 'waiting' | 'active' | 'done';
export type TablePhase = 'players' | 'dealer' | 'round-over';

export interface RoundResult {
  playerValue: number;
  playerBust: boolean;
  dealerValue: number;
  dealerBust: boolean;
  outcome: 'win' | 'lose' | 'push';
  chipsAwarded: number;
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  chips: number;
  entanglements: Entanglement[];
  status: PlayerStatus;
  /** Set once the player stands or busts; combined with the dealer's hand once it plays. */
  finalValue: number | null;
  finalBust: boolean;
  roundResult: RoundResult | null;
}

export interface TableState {
  phase: TablePhase;
  players: PlayerState[];
  activePlayerIndex: number;
  dealerHand: Card[];
  deck: Card[];
  message: string;
  /** Id of the first player to ever reach WIN_GOAL this session; never overwritten. */
  firstWinnerId: string | null;
}

function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    hand: [],
    chips: STARTING_CHIPS,
    entanglements: [],
    status: 'waiting',
    finalValue: null,
    finalBust: false,
    roundResult: null,
  };
}

/** Draws a card for the dealer, immediately measuring it if it's a quantum card. */
function drawAndMeasureDealerCard(deck: Card[]): Card | undefined {
  const card = drawCard(deck);
  if (card && card.kind === 'quantum') {
    observeQuantumCard(card, [], []); // dealer cards are never entangled
  }
  return card;
}

export function dealRound(table: TableState): TableState {
  const deck = createGameDeck();
  const hands: Card[][] = table.players.map(() => []);
  // Round-robin: every player gets a card, then the next card, then the dealer gets 2.
  for (let round = 0; round < 2; round++) {
    hands.forEach((hand) => {
      const card = drawCard(deck);
      if (card) hand.push(card);
    });
  }
  const dealerHand: Card[] = [];
  for (let i = 0; i < 2; i++) {
    const card = drawCard(deck);
    if (card) dealerHand.push(card);
  }

  const players = table.players.map((player, index) => ({
    ...player,
    hand: hands[index],
    entanglements: [],
    status: (index === 0 ? 'active' : 'waiting') as PlayerStatus,
    finalValue: null,
    finalBust: false,
    roundResult: null,
  }));

  return {
    ...table,
    deck,
    dealerHand,
    players,
    activePlayerIndex: 0,
    phase: 'players',
    message: '',
  };
}

export function createTable(names: string[]): TableState {
  const players = names.map((name, index) => createPlayer(`P${index + 1}`, name));
  const table: TableState = {
    phase: 'players',
    players,
    activePlayerIndex: 0,
    dealerHand: [],
    deck: [],
    message: '',
    firstWinnerId: null,
  };
  return dealRound(table);
}

function updatePlayer(table: TableState, index: number, patch: Partial<PlayerState>): TableState {
  const players = table.players.map((p, i) => (i === index ? { ...p, ...patch } : p));
  return { ...table, players };
}

function canAct(table: TableState, index: number): boolean {
  return table.phase === 'players' && table.players[index]?.status === 'active';
}

/** Ends a player's turn (stand or auto-bust): collapses their quantum cards and advances the seat. */
function finishPlayerTurn(table: TableState, index: number): TableState {
  const player = table.players[index];
  const hand = player.hand.map((c) => ({ ...c }));
  resolveAllUnobserved(hand, player.entanglements);
  const finalValue = computeHandValue(hand);
  const finalBust = isBust(finalValue);

  let next = updatePlayer(table, index, { hand, status: 'done', finalValue, finalBust });

  const nextWaitingIndex = next.players.findIndex((p) => p.status === 'waiting');
  if (nextWaitingIndex === -1) {
    next = { ...next, phase: 'dealer' };
  } else {
    next = {
      ...next,
      activePlayerIndex: nextWaitingIndex,
      players: next.players.map((p, i) => (i === nextWaitingIndex ? { ...p, status: 'active' } : p)),
    };
  }
  return next;
}

export function playerHit(table: TableState, index: number): TableState {
  if (!canAct(table, index)) return table;
  const deck = [...table.deck];
  const card = drawCard(deck);
  if (!card) return { ...table, deck, message: 'The deck is empty.' };

  const player = table.players[index];
  const hand = [...player.hand, card];
  let next = updatePlayer({ ...table, deck }, index, { hand });

  const range = computeHandRange(hand, player.entanglements);
  if (isBust(range.min)) next = finishPlayerTurn(next, index);
  return next;
}

export function playerStand(table: TableState, index: number): TableState {
  if (!canAct(table, index)) return table;
  return finishPlayerTurn(table, index);
}

export function observeCard(table: TableState, index: number, cardId: string): TableState {
  if (!canAct(table, index)) return table;
  const player = table.players[index];
  const hand = player.hand.map((c) => ({ ...c }));
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.kind !== 'quantum' || card.observed) return table;
  observeQuantumCard(card, hand, player.entanglements);

  let next = updatePlayer(table, index, { hand });
  const range = computeHandRange(hand, player.entanglements);
  if (isBust(range.min)) next = finishPlayerTurn(next, index);
  return next;
}

export function entangleCards(
  table: TableState,
  index: number,
  cardIdA: string,
  cardIdB: string,
  mode: EntanglementMode,
): TableState {
  if (!canAct(table, index)) return table;
  const player = table.players[index];
  const hand = player.hand.map((c) => ({ ...c }));
  const cardA = hand.find((c) => c.id === cardIdA);
  const cardB = hand.find((c) => c.id === cardIdB);
  const validation = canEntangle(cardA, cardB, player.entanglements, player.chips);
  if (!validation.ok || !cardA || !cardB || cardA.kind !== 'quantum' || cardB.kind !== 'quantum') {
    return { ...table, message: validation.reason ?? 'Cannot entangle these cards.' };
  }

  const entanglement = createEntanglement(cardA, cardB, mode);
  return updatePlayer(table, index, {
    hand,
    chips: player.chips - ENTANGLEMENT_COST,
    entanglements: [...player.entanglements, entanglement],
  });
}

export function advanceDealerAndResolve(table: TableState): TableState {
  if (table.phase !== 'dealer') return table;

  const deck = [...table.deck];
  let dealerHand = table.dealerHand.map((c) => ({ ...c }));
  resolveAllUnobserved(dealerHand, []);
  while (computeHandValue(dealerHand) < 17) {
    const card = drawAndMeasureDealerCard(deck);
    if (!card) break;
    dealerHand = [...dealerHand, card];
  }
  const dealerValue = computeHandValue(dealerHand);
  const dealerBust = isBust(dealerValue);

  let firstWinnerId = table.firstWinnerId;
  const players = table.players.map((player) => {
    const playerValue = player.finalValue ?? 0;
    const playerBust = player.finalBust;
    const { outcome, chipsAwarded } = determineOutcome(playerValue, playerBust, dealerValue, dealerBust);
    const chips = player.chips + chipsAwarded;
    const roundResult: RoundResult = { playerValue, playerBust, dealerValue, dealerBust, outcome, chipsAwarded };
    if (firstWinnerId === null && chips >= WIN_GOAL) firstWinnerId = player.id;
    return { ...player, chips, roundResult };
  });

  return { ...table, deck, dealerHand, players, phase: 'round-over', firstWinnerId };
}

export function startNextRound(table: TableState): TableState {
  return dealRound(table);
}
