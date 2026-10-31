import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "../../app/app_state.ts";
import type { AppAccess } from "../../app/slice.ts";
import { ServerPayload } from "../../generated/pumpkin/protocol.ts";
import api, { type AutoModeInfo } from "../../pumpkin_client.ts";
import type { PumpkinConnection } from "../../pumpkin_connection.ts";
import { autoModeSlice, type AutoModeState } from "./auto_mode_slice.ts";

vi.mock("../../pumpkin_client.ts", () => ({
  default: {
    startAutoMode: vi.fn(),
    stopAutoMode: vi.fn(),
    getAutoMode: vi.fn(),
  },
}));

/** Plays the device's side of the connection auto mode is followed over. */
function createConnection(isOpen = true) {
  let connected: () => void = () => {};
  let notice: (status: AutoModeInfo) => void = () => {};
  const connection = {
    isOpen,
    onConnect: vi.fn((listener: () => void) => {
      connected = listener;
      return () => {};
    }),
    onNotice: vi.fn(
      (_payload: ServerPayload, listener: (status: AutoModeInfo) => void) => {
        notice = listener;
        return () => {};
      },
    ),
  };

  return {
    connection: connection as unknown as PumpkinConnection,
    connect: () => connected(),
    notify: (status: AutoModeInfo) => notice(status),
  };
}

/** The slice's actions over a state of its own, as the controller would set it up. */
function createAutoMode(
  initial: Partial<AutoModeState> = {},
  mode = "Idle",
  connection = createConnection().connection,
) {
  let state: AutoModeState = { ...autoModeSlice.initialState, ...initial };
  const appState = { status: { mode } } as unknown as AppState;
  const setStatus = vi.fn();
  const actions = autoModeSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: {
      connection: async () => connection,
      getState: () => appState,
      actions: () => ({ status: { set: setStatus } }),
    } as unknown as AppAccess,
  });

  return { actions, state: () => state, setStatus };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("autoModeSlice", () => {
  it("asks the device about auto mode, and again whenever it reconnects", async () => {
    vi.mocked(api.getAutoMode).mockResolvedValue({
      running: true,
      minPauseS: 60,
      maxPauseS: 180,
    });
    const device = createConnection();
    const { actions, state, setStatus } = createAutoMode(
      {},
      "Idle",
      device.connection,
    );

    actions.listen(device.connection);

    await vi.waitFor(() => expect(state().isRunning).toBe(true));
    expect(state().pauseId).toBe("long");
    expect(setStatus).toHaveBeenCalledWith({ mode: "Auto" });

    device.connect();
    await vi.waitFor(() => expect(api.getAutoMode).toHaveBeenCalledTimes(2));
  });

  it("waits for the connection to open before asking", () => {
    const device = createConnection(false);
    const { actions } = createAutoMode({}, "Idle", device.connection);

    actions.listen(device.connection);

    expect(api.getAutoMode).not.toHaveBeenCalled();
    expect(device.connection.onConnect).toHaveBeenCalledOnce();
  });

  it("follows auto mode stopping on the device by itself", () => {
    const device = createConnection(false);
    const { actions, state, setStatus } = createAutoMode(
      { isRunning: true },
      "Auto",
      device.connection,
    );
    actions.listen(device.connection);

    device.notify({ running: false, minPauseS: 15, maxPauseS: 45 });

    expect(device.connection.onNotice).toHaveBeenCalledWith(
      ServerPayload.AutoModeStatus,
      expect.any(Function),
    );
    expect(state().isRunning).toBe(false);
    expect(setStatus).toHaveBeenCalledWith({ mode: "Idle", streaming: null });
  });

  it("leaves the status to whatever took over from auto mode", () => {
    const device = createConnection(false);
    const { actions, setStatus } = createAutoMode(
      { isRunning: true },
      "Preset",
      device.connection,
    );
    actions.listen(device.connection);

    device.notify({ running: false, minPauseS: 15, maxPauseS: 45 });

    expect(setStatus).not.toHaveBeenCalled();
  });

  it("starts with the pause picked", async () => {
    vi.mocked(api.startAutoMode).mockResolvedValue();
    const { actions, state, setStatus } = createAutoMode({ pauseId: "long" });

    actions.start();

    await vi.waitFor(() => expect(state().isRunning).toBe(true));
    expect(api.startAutoMode).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ minS: 60, maxS: 180 }),
    );
    expect(setStatus).toHaveBeenCalledWith({ mode: "Auto", streaming: null });
  });

  it("reports auto mode that couldn't be started", async () => {
    vi.mocked(api.startAutoMode).mockRejectedValue(new Error("No SD card"));
    const { actions, state } = createAutoMode({ isRunning: false });

    actions.start();

    await vi.waitFor(() =>
      expect(state().error).toBe("Could not start auto mode: No SD card"),
    );
    expect(state().isRunning).toBe(false);
  });

  it("stops", async () => {
    vi.mocked(api.stopAutoMode).mockResolvedValue();
    const { actions, state } = createAutoMode({ isRunning: true });

    actions.stop();

    await vi.waitFor(() => expect(state().isRunning).toBe(false));
    expect(api.stopAutoMode).toHaveBeenCalledOnce();
  });

  it("starts again with a new pause while running", async () => {
    vi.mocked(api.startAutoMode).mockResolvedValue();
    const { actions, state } = createAutoMode({ isRunning: true });

    actions.setPause("short");

    expect(state().pauseId).toBe("short");
    await vi.waitFor(() =>
      expect(api.startAutoMode).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({ minS: 5, maxS: 15 }),
      ),
    );
  });

  it("only remembers a new pause while stopped", () => {
    const { actions, state } = createAutoMode({ isRunning: false });

    actions.setPause("short");

    expect(state().pauseId).toBe("short");
    expect(api.startAutoMode).not.toHaveBeenCalled();
  });
});
