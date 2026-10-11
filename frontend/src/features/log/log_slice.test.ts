import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import type {
  DeviceLogChunk,
  PumpkinConnection,
} from "../../pumpkin_connection.ts";
import { logSlice, type LogState, MAX_LOG_ENTRIES } from "./log_slice.ts";

const encoder = new TextEncoder();

/** A connection whose log, opening and closing the test drives itself. */
function createConnection(isOpen = true) {
  const listeners = {
    log: new Set<(chunk: DeviceLogChunk) => void>(),
    connect: new Set<() => void>(),
    disconnect: new Set<() => void>(),
  };
  const subscribe =
    <Listener>(set: Set<Listener>) =>
    (listener: Listener) => {
      set.add(listener);
      return () => set.delete(listener);
    };

  const connection = {
    isOpen,
    onLog: subscribe(listeners.log),
    onConnect: subscribe(listeners.connect),
    onDisconnect: subscribe(listeners.disconnect),
  } as unknown as PumpkinConnection;

  return {
    connection,
    send: (boot: number, position: number, text: string) =>
      listeners.log.forEach((listener) =>
        listener({ boot, position, text: encoder.encode(text) }),
      ),
    open: () => listeners.connect.forEach((listener) => listener()),
    drop: () => listeners.disconnect.forEach((listener) => listener()),
  };
}

/** The slice's actions over a state of its own, as the controller would set it up. */
function createLog(app: Partial<AppAccess> = {}) {
  let state: LogState = logSlice.initialState;
  const actions = logSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: app as AppAccess,
  });

  return {
    actions,
    state: () => state,
    shown: () => state.entries.map(({ kind, text }) => `${kind}: ${text}`),
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("logSlice", () => {
  it("shows each line as it arrives", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.send(7, 0, "System ready\n");
    device.send(7, 13, "Client 0 connected (total: 1)\n\nShow ID: 2\n");

    expect(log.shown()).toEqual([
      "line: System ready",
      "line: Client 0 connected (total: 1)",
      "line: ",
      "line: Show ID: 2",
    ]);
  });

  it("splits off how long the pumpkin had been running", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.send(7, 0, "0:00:01.23 System ready\n12:03:04.05 \n");

    expect(log.state().entries).toMatchObject([
      { kind: "line", uptime: "0:00:01.23", text: "System ready" },
      { kind: "line", uptime: "12:03:04.05", text: "" },
    ]);
  });

  it("leaves out what a reconnect sends again", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "one\ntwo\n");

    device.drop();
    device.open();
    device.send(7, 0, "one\ntwo\nthree\n");

    expect(log.shown()).toEqual([
      "line: one",
      "line: two",
      "disconnect: Lost the connection to the pumpkin",
      "line: three",
    ]);
  });

  it("counts the log in bytes, not characters", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "Playing spöke.wav\n");

    device.send(7, 0, "Playing spöke.wav\nShow ID: 0\n");

    expect(log.shown()).toEqual([
      "line: Playing spöke.wav",
      "line: Show ID: 0",
    ]);
  });

  it("notes where the pumpkin restarted", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "before\n");

    device.send(8, 0, "after\n");

    expect(log.shown()).toEqual([
      "line: before",
      "restart: The pumpkin restarted",
      "line: after",
    ]);
  });

  it("notes where some of the log was lost", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "first\n");

    device.send(7, 100, "much later\n");

    expect(log.shown()).toEqual([
      "line: first",
      "gap: Some of the log was lost here",
      "line: much later",
    ]);
  });

  it("starts wherever the device's history does", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.send(7, 5000, "the oldest line it still has\n");

    expect(log.shown()).toEqual(["line: the oldest line it still has"]);
  });

  it("notes a lost connection once, and follows it coming back", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.drop();
    device.drop();

    expect(log.state().isConnected).toBe(false);
    expect(log.shown()).toEqual([
      "disconnect: Lost the connection to the pumpkin",
    ]);

    device.open();
    expect(log.state().isConnected).toBe(true);
  });

  it("counts the lines that arrive while the log isn't on screen", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.send(7, 0, "one\ntwo\n");
    device.drop();
    device.open();
    device.send(7, 0, "one\ntwo\nthree\n");
    device.send(8, 0, "after a restart\n");

    // Each line once, and none of the notes.
    expect(log.state().unread).toBe(4);
  });

  it("reads the lines once the log is on screen, and the ones it shows as they arrive", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "one\ntwo\n");

    log.actions.setVisible(true);
    expect(log.state().unread).toBe(0);
    device.send(7, 8, "three\n");
    expect(log.state().unread).toBe(0);

    log.actions.setVisible(false);
    device.send(7, 14, "four\n");
    expect(log.state().unread).toBe(1);
  });

  it("keeps only the newest entries", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    const lines = Array.from({ length: MAX_LOG_ENTRIES + 5 }, (_, i) => i);
    device.send(7, 0, lines.map((i) => `${i}\n`).join(""));

    expect(log.state().entries).toHaveLength(MAX_LOG_ENTRIES);
    expect(log.state().entries[0].text).toBe("5");
  });

  it("clears what it shows without taking it in again", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    device.send(7, 0, "old\n");

    log.actions.clear();
    device.send(7, 0, "old\nnew\n");

    expect(log.shown()).toEqual(["line: new"]);
  });

  it("stops following the connection once told to", () => {
    const device = createConnection(false);
    const log = createLog();
    const stop = log.actions.listen(device.connection);

    stop();
    device.open();
    device.send(7, 0, "unheard\n");

    expect(log.state().isConnected).toBe(false);
    expect(log.state().entries).toEqual([]);
  });

  it("reconnects when asked", async () => {
    const connection = vi.fn().mockResolvedValue(createConnection().connection);
    const log = createLog({ connection });

    log.actions.reconnect();

    expect(log.state().isConnecting).toBe(true);
    await vi.waitFor(() => expect(log.state().isConnecting).toBe(false));
    expect(connection).toHaveBeenCalledOnce();
  });

  it("can be asked to reconnect again when it couldn't", async () => {
    const connection = vi.fn().mockRejectedValue(new Error("Unreachable"));
    const log = createLog({ connection });

    log.actions.reconnect();

    await vi.waitFor(() => expect(log.state().isConnecting).toBe(false));
  });
});
