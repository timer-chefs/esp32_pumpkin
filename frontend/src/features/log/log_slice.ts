import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import type {
  DeviceLogChunk,
  PumpkinConnection,
} from "../../pumpkin_connection.ts";

/** How many entries the log keeps. The oldest make way for new ones. */
export const MAX_LOG_ENTRIES = 500;

export interface LogEntry {
  /** Never reused, so it can be React's key. */
  id: number;
  /** A line the pumpkin logged, or a note about the log itself. */
  kind: "line" | "restart" | "gap" | "disconnect";
  /**
   * How long the pumpkin had been running when it logged the line, as
   * H:MM:SS.hh. Absent for a note, and for the rest of a line too long to
   * arrive in one piece.
   */
  uptime?: string;
  /**
   * When the pumpkin logged the line, in milliseconds since the epoch.
   * Absent along with `uptime`, or when the pumpkin didn't say how long it
   * had been running.
   */
  loggedAt?: number;
  text: string;
}

export interface LogState {
  entries: LogEntry[];
  /** Lines that have arrived since the log was last on screen. */
  unread: number;
  /** Whether the connection the log arrives over is up. */
  isConnected: boolean;
  isConnecting: boolean;
}

export interface LogActions {
  /** Follows the log over `connection`, until the function it returns is called. */
  listen: (connection: PumpkinConnection) => () => void;
  /** Notes whether the log is on screen, where lines are read as they arrive. */
  setVisible: (isVisible: boolean) => void;
  reconnect: () => void;
  clear: () => void;
}

// See Log's text in the protocol.
const UPTIME_PREFIX = /^((\d+):(\d{2}):(\d{2})\.(\d{2})) /;

/** Reads one line, given when the pumpkin started, if that's known. */
function readLine(
  line: string,
  startedAt: number | null,
): Omit<LogEntry, "id"> {
  const match = UPTIME_PREFIX.exec(line);
  if (!match) {
    return { kind: "line", text: line };
  }

  const [prefix, uptime, hours, minutes, seconds, hundredths] = match;
  const entry: Omit<LogEntry, "id"> = {
    kind: "line",
    uptime,
    text: line.slice(prefix.length),
  };
  if (startedAt !== null) {
    const uptimeMs =
      ((Number(hours) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 +
      Number(hundredths) * 10;
    entry.loggedAt = startedAt + uptimeMs;
  }
  return entry;
}

const notes = {
  restart: "The pumpkin restarted",
  gap: "Some of the log was lost here",
  disconnect: "Lost the connection to the pumpkin",
};

export const logSlice: Slice<LogState, LogActions> = {
  initialState: {
    entries: [],
    unread: 0,
    isConnected: false,
    isConnecting: false,
  },
  createActions: ({ getState, update, app }) => {
    const decoder = new TextDecoder();
    let nextId = 1;
    // The run of the device the log is from, and how far into it the log
    // has got. The device sends everything it remembers to a client that
    // reconnects, and this is how what's already shown is told from what's
    // new.
    let boot: number | null = null;
    let end = 0;
    // When that run started, by this browser's clock. A message only ever
    // arrives after it was sent, so the earliest guess is the closest.
    let startedAt: number | null = null;
    let isVisible = false;

    const withAdded = (added: Omit<LogEntry, "id">[]): LogEntry[] =>
      [
        ...getState().entries,
        ...added.map((entry) => ({ ...entry, id: nextId++ })),
      ].slice(-MAX_LOG_ENTRIES);

    const receive = (chunk: DeviceLogChunk) => {
      const added: Omit<LogEntry, "id">[] = [];
      if (chunk.boot !== boot) {
        if (boot !== null) {
          added.push({ kind: "restart", text: notes.restart });
        }
        boot = chunk.boot;
        end = chunk.position;
        startedAt = null;
      } else if (chunk.position > end) {
        added.push({ kind: "gap", text: notes.gap });
        end = chunk.position;
      }

      // Firmware from before the device said how long it had been running
      // sends 0.
      if (chunk.uptimeUs > 0) {
        const guess = Date.now() - chunk.uptimeUs / 1000;
        startedAt = startedAt === null ? guess : Math.min(startedAt, guess);
      }

      const unseen = chunk.text.subarray(end - chunk.position);
      end = Math.max(end, chunk.position + chunk.text.length);

      const lines = decoder.decode(unseen).split("\n");
      if (lines.at(-1) === "") {
        lines.pop();
      }
      added.push(...lines.map((line) => readLine(line, startedAt)));

      if (added.length > 0) {
        update({
          entries: withAdded(added),
          unread: getState().unread + (isVisible ? 0 : lines.length),
        });
      }
    };

    const disconnected = () => {
      // A failing socket reports both an error and its closing.
      if (getState().isConnected) {
        update({
          isConnected: false,
          entries: withAdded([{ kind: "disconnect", text: notes.disconnect }]),
        });
      }
    };

    return {
      listen: (connection) => {
        update({ isConnected: connection.isOpen });
        const unsubscribes = [
          connection.onLog(receive),
          connection.onConnect(() => update({ isConnected: true })),
          connection.onDisconnect(disconnected),
        ];
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
      },
      setVisible: (visible) => {
        isVisible = visible;
        if (visible) {
          update({ unread: 0 });
        }
      },
      reconnect: () =>
        runAction(async () => {
          update({ isConnecting: true });
          try {
            await app.connection();
          } finally {
            update({ isConnecting: false });
          }
        }),
      clear: () => update({ entries: [] }),
    };
  },
};

export function useLog() {
  return useSlice("log");
}
