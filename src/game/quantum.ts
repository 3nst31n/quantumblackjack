// Observation and entanglement mechanics. This is intentionally simple:
// a quantum card is a coin flip between two fixed values, and entanglement
// just links two coin flips together. No deeper "physics" than that.

import type { Card, QuantumCard } from './cards';
import { hasRedCard } from './cards';

export type EntanglementMode = 'SAME' | 'OPPOSITE';

export interface Entanglement {
  id: string;
  cardAId: string;
  cardBId: string;
  mode: EntanglementMode;
}

export function isQuantumCard(card: Card | undefined): card is QuantumCard {
  return !!card && card.kind === 'quantum';
}

export interface EntangleValidationResult {
  ok: boolean;
  reason?: string;
}

export interface ObserveValidationResult {
  ok: boolean;
  reason?: string;
}

/** A quantum card can only be observed while the hand also holds a red (hearts/diamonds) card. */
export function canObserve(hand: Card[]): ObserveValidationResult {
  if (!hasRedCard(hand)) {
    return { ok: false, reason: 'You need a red card (hearts or diamonds) in hand to observe a quantum card.' };
  }
  return { ok: true };
}

export function canEntangle(
  cardA: Card | undefined,
  cardB: Card | undefined,
  existing: Entanglement[],
  chips: number,
): EntangleValidationResult {
  if (!cardA || !cardB) return { ok: false, reason: 'Select two quantum cards first.' };
  if (cardA.id === cardB.id) return { ok: false, reason: 'A card cannot be entangled with itself.' };
  if (!isQuantumCard(cardA) || !isQuantumCard(cardB)) {
    return { ok: false, reason: 'Only quantum cards can be entangled.' };
  }
  if (cardA.observed || cardB.observed) {
    return { ok: false, reason: 'Observed cards cannot be entangled.' };
  }
  const alreadyEntangled = (id: string) => existing.some((e) => e.cardAId === id || e.cardBId === id);
  if (alreadyEntangled(cardA.id) || alreadyEntangled(cardB.id)) {
    return { ok: false, reason: 'A card can only be part of one entanglement at a time.' };
  }
  if (chips < 1) {
    return { ok: false, reason: 'Entanglement costs 1 chip.' };
  }
  return { ok: true };
}

export function createEntanglement(cardA: QuantumCard, cardB: QuantumCard, mode: EntanglementMode): Entanglement {
  return { id: `E-${cardA.id}-${cardB.id}`, cardAId: cardA.id, cardBId: cardB.id, mode };
}

export function findEntanglementForCard(entanglements: Entanglement[], cardId: string): Entanglement | undefined {
  return entanglements.find((e) => e.cardAId === cardId || e.cardBId === cardId);
}

export function findPartnerId(entanglement: Entanglement, cardId: string): string {
  return entanglement.cardAId === cardId ? entanglement.cardBId : entanglement.cardAId;
}

/**
 * Collapses a quantum card to one concrete value. If the card is entangled and
 * its partner is still unobserved, the partner is resolved too, using the
 * SAME/OPPOSITE relationship to pick its side.
 */
export function observeQuantumCard(
  card: QuantumCard,
  allCards: Card[],
  entanglements: Entanglement[],
  forcedSide?: 0 | 1,
): void {
  if (card.observed) return; // a card can never be observed twice
  const side: 0 | 1 = forcedSide !== undefined ? forcedSide : Math.random() < 0.5 ? 0 : 1;
  card.observed = true;
  card.chosenSide = side;
  card.result = card.values[side];

  const entanglement = findEntanglementForCard(entanglements, card.id);
  if (entanglement) {
    const partnerId = findPartnerId(entanglement, card.id);
    const partner = allCards.find((c) => c.id === partnerId);
    if (isQuantumCard(partner) && !partner.observed) {
      const partnerSide: 0 | 1 = entanglement.mode === 'SAME' ? side : side === 0 ? 1 : 0;
      observeQuantumCard(partner, allCards, entanglements, partnerSide);
    }
  }
}

/** Collapses every remaining unobserved quantum card, used at final round resolution. */
export function resolveAllUnobserved(cards: Card[], entanglements: Entanglement[]): void {
  for (const card of cards) {
    if (card.kind === 'quantum' && !card.observed) {
      observeQuantumCard(card, cards, entanglements);
    }
  }
}
