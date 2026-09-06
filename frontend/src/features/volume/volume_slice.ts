import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";

export interface VolumeState {
  /** Null until the device has told us where it is. */
  level: number | null;
}

export interface VolumeActions {
  load: () => void;
  decrease: () => void;
  increase: () => void;
}

const STEP = 0.1;

export const volumeSlice: Slice<VolumeState, VolumeActions> = {
  initialState: { level: null },
  createActions: ({ update, app }) => {
    const change = async (delta: number) => {
      update({ level: await api.adjustVolume(await app.connection(), delta) });
    };

    return {
      load: () =>
        runAction(async () => {
          update({ level: await api.getVolume(await app.connection()) });
        }),
      decrease: () => runAction(() => change(-STEP)),
      increase: () => runAction(() => change(STEP)),
    };
  },
};

export function useVolume() {
  return useSlice("volume");
}
