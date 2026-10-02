// Chip reward rules, kept separate from hand-value math.

export const STARTING_CHIPS = 3;
export const WIN_GOAL = 10;
export const ENTANGLEMENT_COST = 1;

export type RoundOutcome = 'win' | 'lose' | 'push';

export interface RoundOutcomeResult {
  outcome: RoundOutcome;
  chipsAwarded: number;
}

export function determineOutcome(
  playerValue: number,
  playerBust: boolean,
  dealerValue: number,
  dealerBust: boolean,
): RoundOutcomeResult {
  if (playerBust) return { outcome: 'lose', chipsAwarded: 0 };
  if (dealerBust) return { outcome: 'win', chipsAwarded: playerValue === 21 ? 3 : 2 };
  if (playerValue > dealerValue) return { outcome: 'win', chipsAwarded: playerValue === 21 ? 3 : 2 };
  if (playerValue < dealerValue) return { outcome: 'lose', chipsAwarded: 0 };
  return { outcome: 'push', chipsAwarded: 1 };
}
