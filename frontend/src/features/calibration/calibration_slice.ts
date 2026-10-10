import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api, {
  type EyeCalibrationInfo,
  type EyeServo,
  type ServoRangeInfo,
} from "../../pumpkin_client.ts";
import { throttleLatest } from "../../throttle_latest.ts";
import { toError } from "../../to_error.ts";

/** The largest angle a servo takes. The smallest is 0. */
export const SERVO_MAX_ANGLE = 180;

// The same pace the eye control keeps, for the same reasons.
const SEND_INTERVAL_MS = 50;

/** One end of a servo's range. */
export type ServoEnd = keyof ServoRangeInfo;

export interface CalibrationState {
  /** What the device has stored. Null until it has said. */
  saved: EyeCalibrationInfo | null;
  /** The ranges being tried out. The eye only moves by them once saved. */
  draft: EyeCalibrationInfo | null;
  isLoading: boolean;
  /** The servo whose range is on its way to the device. */
  saving: EyeServo | null;
  error: string | null;
}

export interface CalibrationActions {
  load: () => void;
  /** Sets one end of a servo's range, and moves the servo there to show it. */
  setAngle: (servo: EyeServo, end: ServoEnd, angle: number) => void;
  /** Moves a servo to one end of its range, to show where that is. */
  preview: (servo: EyeServo, end: ServoEnd) => void;
  save: (servo: EyeServo) => void;
  /** Goes back to the range the device has stored. */
  revert: (servo: EyeServo) => void;
}

export const servoTitles: Record<EyeServo, string> = {
  ball: "Eye",
  lid: "Lid",
};

export const calibrationSlice: Slice<CalibrationState, CalibrationActions> = {
  initialState: {
    saved: null,
    draft: null,
    isLoading: false,
    saving: null,
    error: null,
  },
  createActions: ({ getState, update, app }) => {
    // One each, so that moving one servo never holds back the other.
    const previewer = (servo: EyeServo) =>
      throttleLatest(SEND_INTERVAL_MS, (angle: number) =>
        runAction(async () =>
          api.previewServoAngle(await app.connection(), servo, angle),
        ),
      );
    const sendAngle: Record<EyeServo, (angle: number) => void> = {
      ball: previewer("ball"),
      lid: previewer("lid"),
    };

    return {
      load: () =>
        runAction(async () => {
          update({ isLoading: true, error: null });
          try {
            const calibration = await api.getEyeCalibration(
              await app.connection(),
            );
            update({ saved: calibration, draft: calibration });
          } catch (error) {
            console.error("Could not read the eye's calibration:", error);
            update({
              error: `Could not read the calibration: ${toError(error).message}`,
            });
          } finally {
            update({ isLoading: false });
          }
        }),
      setAngle: (servo, end, angle) => {
        const { draft } = getState();
        if (!draft) {
          return;
        }

        const clamped = Math.min(
          SERVO_MAX_ANGLE,
          Math.max(0, Math.round(angle)),
        );
        update({
          draft: { ...draft, [servo]: { ...draft[servo], [end]: clamped } },
        });
        sendAngle[servo](clamped);
      },
      preview: (servo, end) => {
        const { draft } = getState();
        if (draft) {
          sendAngle[servo](draft[servo][end]);
        }
      },
      save: (servo) =>
        runAction(async () => {
          const range = getState().draft?.[servo];
          if (!range) {
            return;
          }

          update({ saving: servo, error: null });
          try {
            await api.saveServoCalibration(
              await app.connection(),
              servo,
              range,
            );
            const { saved } = getState();
            update({ saved: saved && { ...saved, [servo]: range } });
          } catch (error) {
            const title = servoTitles[servo].toLowerCase();
            console.error(`Could not save the ${title} range:`, error);
            update({
              error: `Could not save the ${title} range: ${toError(error).message}`,
            });
          } finally {
            update({ saving: null });
          }
        }),
      revert: (servo) => {
        const { saved, draft } = getState();
        if (saved && draft) {
          update({ draft: { ...draft, [servo]: saved[servo] } });
        }
      },
    };
  },
};

export function useCalibration() {
  return useSlice("calibration");
}
