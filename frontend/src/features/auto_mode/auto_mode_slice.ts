import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { ServerPayload } from "../../generated/pumpkin/protocol.ts";
import api, {
  type AutoModeInfo,
  type PauseRange,
} from "../../pumpkin_client.ts";
import type { PumpkinConnection } from "../../pumpkin_connection.ts";
import { toError } from "../../to_error.ts";

/** How long auto mode pauses after each preset. */
export interface AutoModePause extends PauseRange {
  id: string;
  name: string;
}

export const pauses: AutoModePause[] = [
  { id: "short", name: "Pause 5–15 s", minS: 5, maxS: 15 },
  { id: "medium", name: "Pause 15–45 s", minS: 15, maxS: 45 },
  { id: "long", name: "Pause 1–3 min", minS: 60, maxS: 180 },
];

export interface AutoModeState {
  /** Whether the device is running auto mode, or null until it has said. */
  isRunning: boolean | null;
  pauseId: string;
  error: string | null;
}

export interface AutoModeActions {
  /**
   * Keeps up with auto mode on the device over `connection`, which starts
   * and stops it by itself too, until the function it returns is called.
   */
  listen: (connection: PumpkinConnection) => () => void;
  start: () => void;
  stop: () => void;
  /** Picks how long to pause, which a running auto mode goes by from then on. */
  setPause: (id: string) => void;
}

export const autoModeSlice: Slice<AutoModeState, AutoModeActions> = {
  initialState: { isRunning: null, pauseId: "medium", error: null },
  createActions: ({ getState, update, app }) => {
    const show = (status: AutoModeInfo) => {
      const pause = pauses.find(
        (pause) =>
          pause.minS === status.minPauseS && pause.maxS === status.maxPauseS,
      );
      update({
        isRunning: status.running,
        pauseId: pause?.id ?? getState().pauseId,
      });

      const { mode } = app.getState().status;
      if (status.running && mode === "Idle") {
        app.actions().status.set({ mode: "Auto" });
      } else if (!status.running && mode === "Auto") {
        app.actions().status.set({ mode: "Idle", streaming: null });
      }
    };

    const load = () =>
      runAction(async () =>
        show(await api.getAutoMode(await app.connection())),
      );

    const start = async () => {
      const pause =
        pauses.find((pause) => pause.id === getState().pauseId) ?? pauses[0];

      update({ error: null });
      try {
        await api.startAutoMode(await app.connection(), pause);
        update({ isRunning: true });
        app.actions().status.set({ mode: "Auto", streaming: null });
      } catch (error) {
        console.error("Could not start auto mode:", error);
        update({
          error: `Could not start auto mode: ${toError(error).message}`,
        });
      }
    };

    return {
      listen: (connection) => {
        // Asked again each time the connection comes back, as the device may
        // have restarted in the meantime.
        if (connection.isOpen) {
          load();
        }
        const unsubscribes = [
          connection.onConnect(load),
          connection.onNotice(ServerPayload.AutoModeStatus, show),
        ];
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
      },
      start: () => runAction(start),
      stop: () =>
        runAction(async () => {
          update({ error: null });
          try {
            await api.stopAutoMode(await app.connection());
            update({ isRunning: false });
            if (app.getState().status.mode === "Auto") {
              app.actions().status.set({ mode: "Idle", streaming: null });
            }
          } catch (error) {
            console.error("Could not stop auto mode:", error);
            update({
              error: `Could not stop auto mode: ${toError(error).message}`,
            });
          }
        }),
      setPause: (id) => {
        update({ pauseId: id });
        if (getState().isRunning) {
          runAction(start);
        }
      },
    };
  },
};

export function useAutoMode() {
  return useSlice("autoMode");
}
