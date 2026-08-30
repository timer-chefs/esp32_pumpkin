import { createContext, type PropsWithChildren, useContext } from "react";

import type { AppController } from "./app_controller.ts";

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

export function useAppContext(): AppController {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}
