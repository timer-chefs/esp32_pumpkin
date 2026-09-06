import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { AppContextProvider } from "../app/app_context.tsx";
import { actions, initialState } from "../app/app_controller.ts";
import type { AppController } from "../app/app_controller.ts";
import type { AppActions, AppState } from "../app/app_state.ts";

type SliceOverrides<Shape> = { [Name in keyof Shape]?: Partial<Shape[Name]> };

interface AppControllerOverrides {
  state?: SliceOverrides<AppState>;
  actions?: SliceOverrides<AppActions>;
}

export function renderWithAppContext(
  ui: ReactNode,
  overrides: AppControllerOverrides = {},
): RenderResult & { controller: AppController } {
  const controller: AppController = {
    state: mergeSlices(initialState, overrides.state) as AppState,
    actions: mergeSlices(stubActions(), overrides.actions) as AppActions,
  };

  return {
    ...render(<AppContextProvider value={controller}>{ui}</AppContextProvider>),
    controller,
  };
}

/**
 * Every action as a spy, taken from the real ones so a new action never has
 * to be added here by hand.
 */
function stubActions(): AppActions {
  return Object.fromEntries(
    Object.entries(actions).map(([slice, sliceActions]) => [
      slice,
      Object.fromEntries(
        Object.keys(sliceActions).map((name) => [name, vi.fn()]),
      ),
    ]),
  ) as unknown as AppActions;
}

function mergeSlices<Shape extends object>(
  base: Shape,
  overrides: SliceOverrides<Shape> = {},
): Shape {
  return Object.fromEntries(
    Object.entries(base).map(([name, slice]) => [
      name,
      { ...slice, ...overrides[name as keyof Shape] },
    ]),
  ) as unknown as Shape;
}
