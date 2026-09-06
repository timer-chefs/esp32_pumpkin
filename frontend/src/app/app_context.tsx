import { createContext, type PropsWithChildren, useContext } from "react";

import type { AppController } from "./app_controller.ts";
import type { AppActions, AppState } from "./app_state.ts";

const AppContext = createContext<AppController | null>(null);

export interface AppContextProviderProps extends PropsWithChildren {
  value: AppController;
}

export function AppContextProvider({
  children,
  value,
}: AppContextProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Used by each feature's own hook; components go through those instead. */
export function useAppContext(): AppController {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}

/**
 * A slice's state and actions together, which is what its components want.
 * Each feature wraps this in a hook of its own so components name the
 * feature rather than the shape of the store. A slice's actions must not
 * share a name with its state.
 */
export function useSlice<Name extends keyof AppState>(
  name: Name,
): AppState[Name] & AppActions[Name] {
  const { state, actions } = useAppContext();
  return { ...state[name], ...actions[name] };
}
