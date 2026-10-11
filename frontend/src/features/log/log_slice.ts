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
      } else if (chunk.position > end) {
        added.push({ kind: "gap", text: notes.gap });
        end = chunk.position;
      }

      const unseen = chunk.text.subarray(end - chunk.position);
      end = Math.max(end, chunk.position + chunk.text.length);

      const lines = decoder.decode(unseen).split("\n");
      if (lines.at(-1) === "") {
        lines.pop();
      }
      added.push(...lines.map((text) => ({ kind: "line" as const, text })));

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
