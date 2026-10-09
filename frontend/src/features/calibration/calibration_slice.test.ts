import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";
import type { PumpkinConnection } from "../../pumpkin_connection.ts";
import {
  calibrationSlice,
  type CalibrationState,
} from "./calibration_slice.ts";

vi.mock("../../pumpkin_client.ts", () => ({
  default: {
    previewServoAngle: vi.fn(),
    getEyeCalibration: vi.fn(),
    saveServoCalibration: vi.fn(),
  },
}));

const connection = {} as PumpkinConnection;

const stored = {
  ball: { min: 20, max: 160 },
  lid: { min: 0, max: 180 },
};

/** The slice's actions over a state of its own, as the controller would set it up. */
function createCalibration(initial: Partial<CalibrationState> = {}) {
  let state: CalibrationState = {
    ...calibrationSlice.initialState,
    ...initial,
  };
  const actions = calibrationSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: { connection: async () => connection } as unknown as AppAccess,
  });

  return { actions, state: () => state };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("calibrationSlice", () => {
  it("reads what the device has stored", async () => {
    vi.mocked(api.getEyeCalibration).mockResolvedValue(stored);
    const { actions, state } = createCalibration();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().saved).toEqual(stored);
    expect(state().draft).toEqual(stored);
  });

  it("reports a calibration that couldn't be read", async () => {
    vi.mocked(api.getEyeCalibration).mockRejectedValue(new Error("Timed out"));
    const { actions, state } = createCalibration();

    actions.load();

    await vi.waitFor(() =>
      expect(state().error).toBe("Could not read the calibration: Timed out"),
    );
    expect(state().draft).toBeNull();
  });

  it("moves the servo to an end as it is set, within the angles it takes", async () => {
    const { actions, state } = createCalibration({
      saved: stored,
      draft: stored,
    });

    actions.setAngle("lid", "max", 200);

    expect(state().draft).toEqual({ ...stored, lid: { min: 0, max: 180 } });
    await vi.waitFor(() =>
      expect(api.previewServoAngle).toHaveBeenCalledExactlyOnceWith(
        connection,
        "lid",
        180,
      ),
    );
  });

  it("shows where an end is without changing it", async () => {
    const { actions, state } = createCalibration({
      saved: stored,
      draft: stored,
    });

    actions.preview("ball", "max");

    await vi.waitFor(() =>
      expect(api.previewServoAngle).toHaveBeenCalledExactlyOnceWith(
        connection,
        "ball",
        160,
      ),
    );
    expect(state().draft).toEqual(stored);
  });

  it("stores a servo's range on the device", async () => {
    vi.mocked(api.saveServoCalibration).mockResolvedValue();
    const draft = { ...stored, ball: { min: 30, max: 150 } };
    const { actions, state } = createCalibration({ saved: stored, draft });

    actions.save("ball");

    expect(state().saving).toBe("ball");
    await vi.waitFor(() => expect(state().saving).toBeNull());
    expect(api.saveServoCalibration).toHaveBeenCalledExactlyOnceWith(
      connection,
      "ball",
      { min: 30, max: 150 },
    );
    expect(state().saved).toEqual(draft);
  });

  it("keeps the range unsaved when the device couldn't store it", async () => {
    vi.mocked(api.saveServoCalibration).mockRejectedValue(
      new Error("Could not store the calibration on the device"),
    );
    const draft = { ...stored, lid: { min: 10, max: 170 } };
    const { actions, state } = createCalibration({ saved: stored, draft });

    actions.save("lid");

    await vi.waitFor(() => expect(state().saving).toBeNull());
    expect(state().saved).toEqual(stored);
    expect(state().error).toBe(
      "Could not save the lid range: Could not store the calibration on the device",
    );
  });

  it("goes back to the stored range", () => {
    const { actions, state } = createCalibration({
      saved: stored,
      draft: { ball: { min: 30, max: 150 }, lid: { min: 10, max: 170 } },
    });

    actions.revert("lid");

    expect(state().draft).toEqual({
      ball: { min: 30, max: 150 },
      lid: stored.lid,
    });
  });
});
