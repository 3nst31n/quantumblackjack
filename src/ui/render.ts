// Pure-ish DOM rendering. All game rules live in src/game; this file only
// turns a TableState + UiState into DOM elements and wires up click handlers.

import type { Card } from '../game/cards';
import type { PlayerState, TableState } from '../game/table';
import { computeHandRange } from '../game/blackjack';
import { WIN_GOAL, ENTANGLEMENT_COST } from '../game/chips';
import type { EntanglementMode } from '../game/quantum';
import { findEntanglementForCard } from '../game/quantum';

export type AppPhase = 'setup' | 'table';
export type UiMode = 'idle' | 'observe' | 'entangle';
export type ZoomStage = 'closed' | 'opening' | 'open' | 'closing';

export interface UiState {
  mode: UiMode;
  selected: string[];
  pendingMode: EntanglementMode | null;
  zoomStage: ZoomStage;
  justWonPlayerId: string | null;
}

export function createInitialUiState(): UiState {
  return { mode: 'idle', selected: [], pendingMode: null, zoomStage: 'closed', justWonPlayerId: null };
}

export interface Handlers {
  onStartGame(names: string[]): void;
  onHit(): void;
  onStand(): void;
  onStartObserve(): void;
  onStartEntangle(): void;
  onCardClick(cardId: string): void;
  onChooseEntangleMode(mode: EntanglementMode): void;
  onConfirmEntangle(): void;
  onCancel(): void;
  onNext(): void;
  onDismissWinPopup(): void;
}

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCard(card: Card, opts: { faceDown?: boolean; entangled?: boolean; selected?: boolean }): HTMLElement {
  const node = el('div', 'card');
  if (opts.faceDown) {
    node.classList.add('card--face-down');
    node.appendChild(el('span', 'card__back', '🂠'));
    return node;
  }

  if (card.kind === 'regular') {
    node.classList.add('card--regular');
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    if (isRed) node.classList.add('card--red');
    node.appendChild(el('span', 'card__rank', card.rank));
    node.appendChild(el('span', 'card__suit', SUIT_SYMBOLS[card.suit]));
    return node;
  }

  // quantum card
  node.classList.add('card--quantum');
  if (opts.entangled) node.classList.add('card--entangled');
  if (opts.selected) node.classList.add('card--selected');
  node.appendChild(el('span', 'card__tag', 'Q'));
  if (card.observed) {
    node.classList.add('card--observed');
    node.appendChild(renderResolvedQuantumValues(card.values, card.chosenSide ?? 0));
  } else {
    node.classList.add('card--unobserved');
    node.appendChild(el('span', 'card__superposition', `[${card.values[0]}|${card.values[1]}]`));
  }
  return node;
}

/** Shows both original superposed values with a marker over the one it collapsed to. */
function renderResolvedQuantumValues(values: [number, number], chosenSide: 0 | 1): HTMLElement {
  const wrap = el('div', 'card__resolved');

  const markerRow = el('div', 'card__marker-row');
  const marker0 = el('span', 'card__marker');
  const markerGap = el('span', 'card__marker-gap');
  const marker1 = el('span', 'card__marker');
  if (chosenSide === 0) marker0.classList.add('card__marker--active');
  else marker1.classList.add('card__marker--active');
  markerRow.append(marker0, markerGap, marker1);

  const valuesRow = el('div', 'card__values-row');
  const value0 = el('span', 'card__value-option', String(values[0]));
  const divider = el('span', 'card__values-divider', '|');
  const value1 = el('span', 'card__value-option', String(values[1]));
  if (chosenSide === 0) value0.classList.add('card__value-option--chosen');
  else value1.classList.add('card__value-option--chosen');
  valuesRow.append(value0, divider, value1);

  wrap.append(markerRow, valuesRow);
  return wrap;
}

function renderChipsBar(chips: number): HTMLElement {
  const chipsEl = el('div', 'chips');
  chipsEl.appendChild(el('span', 'chips__count', `Chips: ${chips} / ${WIN_GOAL}`));
  const bar = el('div', 'chips__bar');
  const fill = el('div', 'chips__bar-fill');
  fill.style.width = `${Math.min(100, (chips / WIN_GOAL) * 100)}%`;
  bar.appendChild(fill);
  chipsEl.appendChild(bar);
  return chipsEl;
}

export function renderSetupScreen(handlers: Handlers): HTMLElement {
  const screen = el('div', 'setup');
  screen.appendChild(el('h1', 'title', 'Quantum Blackjack'));
  screen.appendChild(el('p', 'hint', 'Pick how many players are seated at the table.'));

  const MAX_PLAYERS = 6;
  let count = 2;

  const form = el('div', 'setup__form');
  const countRow = el('div', 'setup__count-row');
  countRow.appendChild(el('span', undefined, 'Players:'));
  const countInput = el('input', 'setup__count-input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = String(MAX_PLAYERS);
  countInput.value = String(count);
  countRow.appendChild(countInput);
  form.appendChild(countRow);

  const namesWrap = el('div', 'setup__names');
  function renderNameInputs(): void {
    namesWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = el('input', 'setup__name-input');
      input.placeholder = `Player ${i + 1}`;
      input.value = `Player ${i + 1}`;
      namesWrap.appendChild(input);
    }
  }
  renderNameInputs();
  form.appendChild(namesWrap);

  countInput.addEventListener('input', () => {
    const parsed = Math.max(1, Math.min(MAX_PLAYERS, Number(countInput.value) || 1));
    count = parsed;
    renderNameInputs();
  });

  const startBtn = el('button', 'btn btn--primary', 'Start Game');
  startBtn.addEventListener('click', () => {
    const inputs = Array.from(namesWrap.querySelectorAll<HTMLInputElement>('.setup__name-input'));
    const names = inputs.map((input, i) => input.value.trim() || `Player ${i + 1}`);
    handlers.onStartGame(names);
  });
  form.appendChild(startBtn);

  screen.appendChild(form);
  return screen;
}

function renderDealerArea(table: TableState): HTMLElement {
  const section = el('section', 'area dealer-area');
  section.appendChild(el('h2', 'area__title', 'Dealer'));
  const cardsRow = el('div', 'cards-row');
  const hideHoleCard = table.phase === 'players';
  table.dealerHand.forEach((card, index) => {
    const faceDown = hideHoleCard && index === 1;
    cardsRow.appendChild(renderCard(card, { faceDown }));
  });
  section.appendChild(cardsRow);

  const status = el('div', 'area__status');
  if (hideHoleCard) {
    status.textContent = 'Dealer hand: hidden until all players finish';
  } else if (table.phase === 'round-over') {
    const dealerBust = table.players[0]?.roundResult?.dealerBust;
    const dealerValue = table.players[0]?.roundResult?.dealerValue;
    status.textContent = `Dealer hand: ${dealerValue}${dealerBust ? ' (bust)' : ''}`;
  } else {
    status.textContent = 'Dealer hand: revealing…';
  }
  section.appendChild(status);
  return section;
}

function renderSeat(player: PlayerState, index: number, table: TableState): HTMLElement {
  const seat = el('div', 'seat');
  if (table.phase === 'players' && index === table.activePlayerIndex) seat.classList.add('seat--active');
  if (player.status === 'done') seat.classList.add('seat--done');

  const nameRow = el('div', 'seat__name-row');
  nameRow.appendChild(el('span', 'seat__name', player.name));
  if (player.id === table.firstWinnerId) nameRow.appendChild(el('span', 'seat__badge seat__badge--crown', '👑'));
  seat.appendChild(nameRow);

  seat.appendChild(renderChipsBar(player.chips));

  const cardsRow = el('div', 'cards-row cards-row--mini');
  player.hand.forEach((card) => {
    const entangled = !!findEntanglementForCard(player.entanglements, card.id);
    cardsRow.appendChild(renderCard(card, { entangled }));
  });
  seat.appendChild(cardsRow);

  const status = el('div', 'seat__status');
  if (table.phase === 'round-over' && player.roundResult) {
    const r = player.roundResult;
    const outcomeText = r.outcome === 'win' ? 'Win' : r.outcome === 'lose' ? 'Lose' : 'Push';
    const badge = el('span', `seat__badge seat__badge--result seat__badge--${r.outcome}`, outcomeText);
    status.appendChild(badge);
    status.appendChild(el('span', undefined, ` (${r.playerValue}${r.playerBust ? ' bust' : ''}, +${r.chipsAwarded})`));
  } else {
    const range = computeHandRange(player.hand, player.entanglements);
    status.textContent = range.isCertain ? `Value: ${range.min}` : `Value: ${range.values.join(', ')}`;
  }
  seat.appendChild(status);

  return seat;
}

function renderControls(player: PlayerState, ui: UiState, handlers: Handlers): HTMLElement {
  const controls = el('div', 'controls');
  const canAct = ui.mode === 'idle';

  const hitBtn = el('button', 'btn', 'Hit');
  hitBtn.disabled = !canAct;
  hitBtn.addEventListener('click', handlers.onHit);

  const standBtn = el('button', 'btn', 'Stand');
  standBtn.disabled = !canAct;
  standBtn.addEventListener('click', handlers.onStand);

  const hasUnobservedQuantum = player.hand.some((c) => c.kind === 'quantum' && !c.observed);
  const observeBtn = el('button', 'btn', 'Observe Quantum Card');
  observeBtn.disabled = !canAct || !hasUnobservedQuantum;
  observeBtn.addEventListener('click', handlers.onStartObserve);

  const entangleBtn = el('button', 'btn', 'Entangle Quantum Cards');
  entangleBtn.disabled = !canAct || !hasUnobservedQuantum || player.chips < ENTANGLEMENT_COST;
  entangleBtn.addEventListener('click', handlers.onStartEntangle);

  controls.append(hitBtn, standBtn, observeBtn, entangleBtn);

  if (ui.mode === 'observe') {
    const hint = el('div', 'hint', 'Select an unobserved quantum card to collapse it.');
    const cancelBtn = el('button', 'btn btn--ghost', 'Cancel');
    cancelBtn.addEventListener('click', handlers.onCancel);
    controls.append(hint, cancelBtn);
  }

  return controls;
}

function renderEntanglePanel(player: PlayerState, ui: UiState, handlers: Handlers): HTMLElement {
  const panel = el('div', 'panel');
  panel.appendChild(el('h3', 'panel__title', 'Entangle Quantum Cards'));
  panel.appendChild(el('p', 'panel__hint', `Select two unobserved quantum cards. Cost: ${ENTANGLEMENT_COST} chip`));
  panel.appendChild(el('p', 'panel__selection', `Selected: ${ui.selected.length} / 2`));

  if (ui.selected.length === 2) {
    const modeRow = el('div', 'panel__modes');
    (['SAME', 'OPPOSITE'] as EntanglementMode[]).forEach((mode) => {
      const btn = el('button', 'btn', mode);
      if (ui.pendingMode === mode) btn.classList.add('btn--active');
      btn.addEventListener('click', () => handlers.onChooseEntangleMode(mode));
      modeRow.appendChild(btn);
    });
    panel.appendChild(modeRow);

    const confirmBtn = el('button', 'btn btn--primary', 'Confirm Entanglement');
    confirmBtn.disabled = !ui.pendingMode || player.chips < ENTANGLEMENT_COST;
    confirmBtn.addEventListener('click', handlers.onConfirmEntangle);
    panel.appendChild(confirmBtn);
  }

  const cancelBtn = el('button', 'btn btn--ghost', 'Cancel');
  cancelBtn.addEventListener('click', handlers.onCancel);
  panel.appendChild(cancelBtn);

  return panel;
}

/** Overlay that zooms in on the active player's hand; transform-origin is set from the seat's screen position. */
function renderPlayerOverlay(
  table: TableState,
  ui: UiState,
  handlers: Handlers,
  origin: { x: number; y: number } | null,
): HTMLElement {
  const player = table.players[table.activePlayerIndex];

  const backdrop = el('div', 'overlay-backdrop');
  const panel = el('div', 'overlay-panel');
  if (origin) {
    panel.style.setProperty('--origin-x', `${origin.x}px`);
    panel.style.setProperty('--origin-y', `${origin.y}px`);
  }

  panel.appendChild(el('h2', 'overlay__title', player.name));

  const cardsRow = el('div', 'cards-row');
  player.hand.forEach((card) => {
    const entangled = !!findEntanglementForCard(player.entanglements, card.id);
    const selected = ui.selected.includes(card.id);
    const cardNode = renderCard(card, { entangled, selected });

    const isSelectableForObserve = ui.mode === 'observe' && card.kind === 'quantum' && !card.observed;
    const isSelectableForEntangle = ui.mode === 'entangle' && card.kind === 'quantum' && !card.observed;
    if (isSelectableForObserve || isSelectableForEntangle) {
      cardNode.classList.add('card--clickable');
      cardNode.addEventListener('click', () => handlers.onCardClick(card.id));
    }
    cardsRow.appendChild(cardNode);
  });
  panel.appendChild(cardsRow);

  const range = computeHandRange(player.hand, player.entanglements);
  const status = el('div', 'area__status');
  status.textContent = range.isCertain ? `Hand value: ${range.min}` : `Hand value: ${range.values.join(', ')}`;
  panel.appendChild(status);

  if (table.message) panel.appendChild(el('p', 'panel__error', table.message));

  panel.appendChild(renderControls(player, ui, handlers));
  if (ui.mode === 'entangle') panel.appendChild(renderEntanglePanel(player, ui, handlers));

  // The DOM is rebuilt from scratch every render, so the visible/hidden CSS
  // classes must be applied explicitly per stage rather than just once on mount:
  // 'open' needs to render already-visible (no replay on every action while playing),
  // 'opening'/'closing' start from the opposite state and flip on the next frame to animate.
  if (ui.zoomStage === 'open') {
    backdrop.classList.add('overlay-backdrop--visible');
    panel.classList.add('overlay-panel--visible');
  } else if (ui.zoomStage === 'opening') {
    requestAnimationFrame(() => {
      backdrop.classList.add('overlay-backdrop--visible');
      panel.classList.add('overlay-panel--visible');
    });
  } else if (ui.zoomStage === 'closing') {
    backdrop.classList.add('overlay-backdrop--visible');
    panel.classList.add('overlay-panel--visible');
    requestAnimationFrame(() => {
      backdrop.classList.remove('overlay-backdrop--visible');
      panel.classList.remove('overlay-panel--visible');
    });
  }

  const wrap = el('div', 'overlay');
  wrap.append(backdrop, panel);
  return wrap;
}

function renderWinPopup(playerName: string, handlers: Handlers): HTMLElement {
  const backdrop = el('div', 'overlay-backdrop overlay-backdrop--visible');
  const panel = el('div', 'panel panel--victory win-popup');
  panel.appendChild(el('h2', undefined, '👑 We have a winner!'));
  panel.appendChild(el('p', undefined, `${playerName} reached the ${WIN_GOAL}-chip goal.`));
  const dismissBtn = el('button', 'btn btn--primary', 'Continue');
  dismissBtn.addEventListener('click', handlers.onDismissWinPopup);
  panel.appendChild(dismissBtn);

  const wrap = el('div', 'overlay');
  wrap.append(backdrop, panel);
  return wrap;
}

function nextButtonLabel(table: TableState, ui: UiState): string {
  if (table.phase === 'round-over') return 'Deal Next Round';
  if (table.phase === 'dealer') return 'Reveal Dealer Hand';
  if (ui.zoomStage !== 'closed') return 'Zooming In…';
  return 'Zoom to Next Player';
}

export function renderTableScreen(
  table: TableState,
  ui: UiState,
  handlers: Handlers,
  seatOrigin: { x: number; y: number } | null,
): HTMLElement {
  const wrapper = el('div', 'table');

  wrapper.appendChild(renderDealerArea(table));

  const seats = el('div', 'seats');
  table.players.forEach((player, index) => seats.appendChild(renderSeat(player, index, table)));
  wrapper.appendChild(seats);

  const dealerBar = el('div', 'dealer-bar');
  const nextBtn = el('button', 'btn btn--primary btn--next', nextButtonLabel(table, ui));
  nextBtn.disabled = table.phase === 'players' && ui.zoomStage !== 'closed';
  nextBtn.addEventListener('click', handlers.onNext);
  dealerBar.appendChild(nextBtn);
  wrapper.appendChild(dealerBar);

  if (ui.zoomStage !== 'closed') {
    wrapper.appendChild(renderPlayerOverlay(table, ui, handlers, seatOrigin));
  }

  if (ui.justWonPlayerId) {
    const winner = table.players.find((p) => p.id === ui.justWonPlayerId);
    if (winner) wrapper.appendChild(renderWinPopup(winner.name, handlers));
  }

  return wrapper;
}

export function render(
  root: HTMLElement,
  phase: AppPhase,
  table: TableState | null,
  ui: UiState,
  handlers: Handlers,
  seatOrigin: { x: number; y: number } | null,
): void {
  root.innerHTML = '';
  if (phase === 'setup' || !table) {
    root.appendChild(renderSetupScreen(handlers));
    return;
  }
  root.appendChild(renderTableScreen(table, ui, handlers, seatOrigin));
}
