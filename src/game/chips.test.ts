import { describe, it, expect } from 'vitest';
import { determineOutcome, WIN_GOAL } from '../game/chips';

describe('chip rewards', () => {
  it('awards +2 for a normal win', () => {
    expect(determineOutcome(19, false, 17, false)).toEqual({ outcome: 'win', chipsAwarded: 2 });
  });

  it('awards +3 for a win with exactly 21', () => {
    expect(determineOutcome(21, false, 20, false)).toEqual({ outcome: 'win', chipsAwarded: 3 });
  });

  it('awards 0 chips for a loss', () => {
    expect(determineOutcome(18, false, 20, false)).toEqual({ outcome: 'lose', chipsAwarded: 0 });
  });

  it('awards 1 chip for a tie/push', () => {
    expect(determineOutcome(19, false, 19, false)).toEqual({ outcome: 'push', chipsAwarded: 1 });
  });

  it('a player bust always loses, even if the dealer also busts', () => {
    expect(determineOutcome(22, true, 24, true)).toEqual({ outcome: 'lose', chipsAwarded: 0 });
  });

  it('a dealer bust wins for the player', () => {
    expect(determineOutcome(18, false, 24, true)).toEqual({ outcome: 'win', chipsAwarded: 2 });
  });

  it('the win goal is 10 chips', () => {
    expect(WIN_GOAL).toBe(10);
  });
});
