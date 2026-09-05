import type { PumpkinConnection } from "../pumpkin_connection.ts";
import type { AppActions, AppState } from "./app_state.ts";

/** What a slice can reach outside its own state. */
export interface AppAccess {
  /** The whole state, for the occasional read across features. */
  getState: () => AppState;
  /**
   * Every slice's actions. Resolved lazily, so a slice can call one that is
   * created after it without the composition having to be ordered.
   */
  actions: () => AppActions;
  connection: () => Promise<PumpkinConnection>;
}

/**
 * A slice owns its own state and can only write to that: anything shared
 * goes through the owning slice's actions.
 */
export interface SliceContext<State> {
  getState: () => State;
  update: (partial: Partial<State>) => void;
  app: AppAccess;
}

export interface Slice<State extends object, Actions extends object> {
  initialState: State;
  createActions: (context: SliceContext<State>) => Actions;
}

/**
 * Runs an action that the UI fires and forgets, so a failure is reported
 * rather than surfacing as an unhandled rejection.
 */
export function runAction(action: () => void | Promise<void>): void {
  try {
    Promise.resolve(action()).catch((error) =>
      console.error("Action failed:", error),
    );
  } catch (error) {
    console.error("Action failed:", error);
  }
}
