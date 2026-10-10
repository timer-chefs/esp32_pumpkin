import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";
import { throttleLatest } from "../../throttle_latest.ts";

/** How far the eye turns either way, in the units MoveEye takes. */
export const EYE_REACH = 127;
export const LID_OPEN = 255;

// A servo can't follow a drag any faster than this anyway, and it keeps a
// drag from crowding out the audio sharing the connection.
const SEND_INTERVAL_MS = 50;

export interface EyeState {
  /** Negative is left, 0 straight ahead, positive right. */
  position: number;
  /** 0 is shut, LID_OPEN wide open. */
  lid: number;
}

export interface EyeActions {
  look: (at: number) => void;
  moveLid: (openness: number) => void;
}

export const eyeSlice: Slice<EyeState, EyeActions> = {
  // The device can't be asked where the eye is, so this is a guess until
  // the first move.
  initialState: { position: 0, lid: LID_OPEN },
  createActions: ({ update, app }) => {
    const sendPosition = throttleLatest(SEND_INTERVAL_MS, (at: number) =>
      runAction(async () => api.moveEye(await app.connection(), at)),
    );
    const sendLid = throttleLatest(SEND_INTERVAL_MS, (openness: number) =>
      runAction(async () => api.moveEyeLid(await app.connection(), openness)),
    );

    return {
      look: (at) => {
        update({ position: at });
        sendPosition(at);
      },
      moveLid: (openness) => {
        update({ lid: openness });
        sendLid(openness);
      },
    };
  },
};

export function useEye() {
  return useSlice("eye");
}
