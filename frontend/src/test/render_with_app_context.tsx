import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { AppContextProvider } from "../app_context.tsx";
import type { AppActions, AppController, AppState } from "../app_controller.ts";

interface AppControllerOverrides {
  state?: Partial<AppState>;
  actions?: Partial<AppActions>;
}

export function renderWithAppContext(
  ui: ReactNode,
  overrides: AppControllerOverrides = {},
): RenderResult & { controller: AppController } {
  const controller: AppController = {
    state: {
      activeSource: null,
      currentMode: "Idle",
      currentStreaming: null,
      fileStatus: null,
      folderStatus: null,
      microphoneStatus: null,
      streamFileEnabled: false,
      volume: 1,
      ...overrides.state,
    },
    actions: {
      decreaseVolume: vi.fn(),
      increaseVolume: vi.fn(),
      playGhostShow: vi.fn(),
      selectAudioFile: vi.fn(),
      selectAudioFolder: vi.fn(),
      startFile: vi.fn(),
      startFileMode: vi.fn(),
      startMicrophone: vi.fn(),
      stopAudio: vi.fn(),
      stopMicrophone: vi.fn(),
      ...overrides.actions,
    },
  };

  return {
    ...render(<AppContextProvider value={controller}>{ui}</AppContextProvider>),
    controller,
  };
}
