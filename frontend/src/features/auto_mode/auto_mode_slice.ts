import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { ServerPayload } from "../../generated/pumpkin/protocol.ts";
import api, {
  type AutoModeInfo,
  type PauseRange,
} from "../../pumpkin_client.ts";
import type { PumpkinConnection } from "../../pumpkin_connection.ts";
import { toError } from "../../to_error.ts";

/** The longest pause the protocol has room for, in seconds. */
export const maxPauseS = 0xffff;

export interface AutoModeState {
  /** Whether the device is running auto mode, or null until it has said. */
  isRunning: boolean | null;
  /** How long to pause after each preset: a random time between the two. */
  pause: PauseRange;
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
  /** Sets how long to pause, which a running auto mode goes by from then on. */
  setPause: (pause: PauseRange) => void;
}

export const autoModeSlice: Slice<AutoModeState, AutoModeActions> = {
  // The device's own default, until it says what it last ran with.
  initialState: { isRunning: null, pause: { minS: 15, maxS: 45 }, error: null },
  createActions: ({ getState, update, app }) => {
    const show = (status: AutoModeInfo) => {
      update({
        isRunning: status.running,
        pause: { minS: status.minPauseS, maxS: status.maxPauseS },
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
      update({ error: null });
      try {
        await api.startAutoMode(await app.connection(), getState().pause);
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
      setPause: (pause) => {
        update({ pause });
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
