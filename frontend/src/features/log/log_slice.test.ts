import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    send: (boot: number, position: number, text: string, uptimeUs = 0) =>
      listeners.log.forEach((listener) =>
        listener({ boot, position, text: encoder.encode(text), uptimeUs }),
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

afterEach(() => {
  vi.useRealTimers();
});

/** Sets this browser's clock to a time of day on the day of the tests. */
function setClock(hours: number, minutes: number, seconds: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(localTime(hours, minutes, seconds));
}

function localTime(hours: number, minutes: number, seconds: number, ms = 0) {
  return new Date(2026, 9, 11, hours, minutes, seconds, ms).getTime();
}

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

  it("works out the time of day each line was logged", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    // Sent a minute after the pumpkin started, so it started at 17:59.
    setClock(18, 0, 0);
    device.send(7, 0, "0:00:30.50 Show ID: 2\n", 60_000_000);

    expect(log.state().entries[0].loggedAt).toBe(localTime(17, 59, 30, 500));
  });

  it("goes by the message that took the least time to arrive", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    setClock(18, 0, 0);
    device.send(7, 0, "0:00:30.00 a\n", 60_000_000);

    // Held up for 5 s on the way, which mustn't move when it started...
    setClock(18, 0, 10);
    device.send(7, 13, "0:01:00.00 b\n", 65_000_000);
    // ...but this one, a second quicker than the first, should.
    setClock(18, 0, 20);
    device.send(7, 26, "0:01:10.00 c\n", 81_000_000);

    expect(log.state().entries.map((entry) => entry.loggedAt)).toEqual([
      localTime(17, 59, 30),
      localTime(18, 0, 0),
      localTime(18, 0, 9),
    ]);
  });

  it("works out anew when a restarted pumpkin started", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);
    setClock(18, 0, 0);
    device.send(7, 0, "0:00:30.00 before\n", 60_000_000);

    setClock(19, 0, 0);
    device.send(8, 0, "0:00:01.00 after\n", 2_000_000);

    expect(log.state().entries.at(-1)?.loggedAt).toBe(localTime(18, 59, 59));
  });

  it("can't tell the time when the pumpkin doesn't say how long it has run", () => {
    const device = createConnection();
    const log = createLog();
    log.actions.listen(device.connection);

    device.send(7, 0, "0:00:30.00 Show ID: 2\n", 0);

    expect(log.state().entries[0]).toMatchObject({ uptime: "0:00:30.00" });
    expect(log.state().entries[0].loggedAt).toBeUndefined();
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
