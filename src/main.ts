import './style.css';
import type { TableState } from './game/table';
import {
  createTable,
  playerHit,
  playerStand,
  observeCard,
  entangleCards,
  advanceDealerAndResolve,
  startNextRound,
} from './game/table';
import type { EntanglementMode } from './game/quantum';
import type { AppPhase, UiState, Handlers } from './ui/render';
import { render, createInitialUiState } from './ui/render';

// How long the overlay's CSS zoom transition takes; kept in sync with style.css.
const ZOOM_TRANSITION_MS = 300;

const root = document.querySelector<HTMLDivElement>('#app')!;

let phase: AppPhase = 'setup';
let table: TableState | null = null;
let ui: UiState = createInitialUiState();

function resetActionUi(): void {
  ui = { ...ui, mode: 'idle', selected: [], pendingMode: null };
}

function getSeatOrigin(): { x: number; y: number } | null {
  if (!table) return null;
  const seatNodes = root.querySelectorAll<HTMLElement>('.seat');
  const seatNode = seatNodes[table.activePlayerIndex];
  if (!seatNode) return null;
  const rect = seatNode.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function rerender(): void {
  render(root, phase, table, ui, handlers, getSeatOrigin());
}

/** After a player's turn ends (stand or auto-bust), animate the overlay closed. */
function closeOverlayIfActivePlayerDone(previousActiveId: string | undefined): void {
  if (!table) return;
  const player = table.players.find((p) => p.id === previousActiveId);
  if (!player || player.status !== 'done') return;

  resetActionUi();
  ui = { ...ui, zoomStage: 'closing' };
  rerender();
  setTimeout(() => {
    ui = { ...ui, zoomStage: 'closed' };
    rerender();
  }, ZOOM_TRANSITION_MS);
}

const handlers: Handlers = {
  onStartGame(names: string[]) {
    table = createTable(names);
    phase = 'table';
    ui = createInitialUiState();
    rerender();
  },
  onHit() {
    if (!table) return;
    const previousActiveId = table.players[table.activePlayerIndex]?.id;
    table = playerHit(table, table.activePlayerIndex);
    rerender();
    closeOverlayIfActivePlayerDone(previousActiveId);
  },
  onStand() {
    if (!table) return;
    const previousActiveId = table.players[table.activePlayerIndex]?.id;
    table = playerStand(table, table.activePlayerIndex);
    rerender();
    closeOverlayIfActivePlayerDone(previousActiveId);
  },
  onStartObserve() {
    ui = { ...ui, mode: 'observe', selected: [], pendingMode: null };
    rerender();
  },
  onStartEntangle() {
    ui = { ...ui, mode: 'entangle', selected: [], pendingMode: null };
    rerender();
  },
  onCardClick(cardId: string) {
    if (!table) return;
    if (ui.mode === 'observe') {
      const previousActiveId = table.players[table.activePlayerIndex]?.id;
      table = observeCard(table, table.activePlayerIndex, cardId);
      resetActionUi();
      rerender();
      closeOverlayIfActivePlayerDone(previousActiveId);
      return;
    }
    if (ui.mode === 'entangle') {
      if (ui.selected.includes(cardId)) {
        ui = { ...ui, selected: ui.selected.filter((id) => id !== cardId) };
      } else if (ui.selected.length < 2) {
        ui = { ...ui, selected: [...ui.selected, cardId] };
      }
    }
    rerender();
  },
  onChooseEntangleMode(mode: EntanglementMode) {
    ui = { ...ui, pendingMode: mode };
    rerender();
  },
  onConfirmEntangle() {
    if (table && ui.selected.length === 2 && ui.pendingMode) {
      table = entangleCards(table, table.activePlayerIndex, ui.selected[0], ui.selected[1], ui.pendingMode);
    }
    resetActionUi();
    rerender();
  },
  onCancel() {
    resetActionUi();
    rerender();
  },
  onNext() {
    if (!table) return;
    if (table.phase === 'players' && ui.zoomStage === 'closed') {
      ui = { ...ui, zoomStage: 'opening' };
      rerender();
      requestAnimationFrame(() => {
        ui = { ...ui, zoomStage: 'open' };
        rerender();
      });
      return;
    }
    if (table.phase === 'dealer') {
      const hadFirstWinner = table.firstWinnerId !== null;
      table = advanceDealerAndResolve(table);
      if (!hadFirstWinner && table.firstWinnerId !== null) {
        ui = { ...ui, justWonPlayerId: table.firstWinnerId };
      }
      rerender();
      return;
    }
    if (table.phase === 'round-over') {
      table = startNextRound(table);
      ui = createInitialUiState();
      rerender();
    }
  },
  onDismissWinPopup() {
    ui = { ...ui, justWonPlayerId: null };
    rerender();
  },
};

rerender();
