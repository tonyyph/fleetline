import { checkPlacement, occupiedCells, randomFleet, type FleetError, type Rng } from './fleet';
import { fromCell } from './board';
import { FLEET, type Cell, type Orientation, type ShipId, type ShipPlacement } from './types';

/** Local state of the ship-placement screen. Pure reducer so it can be tested without React. */
export interface PlacementState {
  placed: ShipPlacement[];
  selected: ShipId | null;
  orientation: Orientation;
  history: ShipPlacement[][];
  lastError: FleetError | null;
}

export type PlacementAction =
  | { type: 'select'; id: ShipId }
  | { type: 'rotate' }
  | { type: 'tap'; cell: Cell }
  | { type: 'undo' }
  | { type: 'clear' }
  | { type: 'randomize'; rng?: Rng };

export const initialPlacement: PlacementState = {
  placed: [],
  selected: FLEET[0].id,
  orientation: 'h',
  history: [],
  lastError: null,
};

function nextUnplaced(placed: readonly ShipPlacement[]): ShipId | null {
  return FLEET.find((s) => !placed.some((p) => p.id === s.id))?.id ?? null;
}

function commit(
  state: PlacementState,
  placed: ShipPlacement[],
  selected: ShipId | null,
): PlacementState {
  return { ...state, placed, selected, history: [...state.history, state.placed], lastError: null };
}

export function placementReducer(state: PlacementState, action: PlacementAction): PlacementState {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.id, lastError: null };
    case 'rotate':
      return { ...state, orientation: state.orientation === 'h' ? 'v' : 'h', lastError: null };
    case 'tap': {
      // Tapping a placed ship picks it back up so it can be moved or rotated.
      const owner = occupiedCells(state.placed).get(action.cell);
      if (owner) {
        const ship = state.placed.find((p) => p.id === owner)!;
        return {
          ...commit(
            state,
            state.placed.filter((p) => p.id !== owner),
            owner,
          ),
          orientation: ship.o,
        };
      }
      if (!state.selected) return state;
      const { x, y } = fromCell(action.cell);
      const candidate: ShipPlacement = { id: state.selected, x, y, o: state.orientation };
      const others = state.placed.filter((p) => p.id !== state.selected);
      const err = checkPlacement(others, candidate);
      if (err) return { ...state, lastError: err };
      const placed = [...others, candidate];
      return commit(state, placed, nextUnplaced(placed));
    }
    case 'undo': {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return {
        ...state,
        placed: prev,
        history: state.history.slice(0, -1),
        selected: nextUnplaced(prev),
        lastError: null,
      };
    }
    case 'clear':
      if (state.placed.length === 0) return state;
      return commit(state, [], FLEET[0].id);
    case 'randomize':
      return commit(state, randomFleet(action.rng), null);
  }
}

export function isPlacementComplete(state: PlacementState): boolean {
  return state.placed.length === FLEET.length;
}
