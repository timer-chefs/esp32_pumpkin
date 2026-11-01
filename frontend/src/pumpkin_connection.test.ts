import * as flatbuffers from "flatbuffers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AutoModeStatus,
  Log,
  Message,
  MessageBody,
  ServerMessage,
  ServerPayload,
} from "./generated/pumpkin/protocol.ts";
import { PumpkinConnection } from "./pumpkin_connection.ts";

/** Stands in for the browser's WebSocket, so a test can play the device. */
class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static latest: FakeWebSocket;

  readyState = FakeWebSocket.CONNECTING;
  binaryType = "blob";
  send = vi.fn();

  constructor() {
    super();
    FakeWebSocket.latest = this;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  receive(data: ArrayBuffer) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

/** What the device sends to stream its log. */
function encodeLog(
  boot: number,
  position: number,
  text: string,
  uptimeUs = 0n,
): ArrayBuffer {
  const builder = new flatbuffers.Builder();
  const log = Log.createLog(
    builder,
    boot,
    position,
    builder.createString(text),
    uptimeUs,
  );
  const serverMessage = ServerMessage.createServerMessage(
    builder,
    0,
    ServerPayload.Log,
    log,
  );
  Message.finishMessageBuffer(
    builder,
    Message.createMessage(builder, MessageBody.ServerMessage, serverMessage),
  );
  return builder.asUint8Array().slice().buffer;
}

/** Wraps a payload the way the device sends it. */
function encodeServerMessage(
  requestId: number,
  payloadType: ServerPayload,
  createPayload: (builder: flatbuffers.Builder) => flatbuffers.Offset,
): ArrayBuffer {
  const builder = new flatbuffers.Builder();
  const payload = createPayload(builder);
  const serverMessage = ServerMessage.createServerMessage(
    builder,
    requestId,
    payloadType,
    payload,
  );
  Message.finishMessageBuffer(
    builder,
    Message.createMessage(builder, MessageBody.ServerMessage, serverMessage),
  );
  return builder.asUint8Array().slice().buffer;
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PumpkinConnection", () => {
  it("hands the device's log to whoever listens for it", () => {
    const connection = new PumpkinConnection("pumpkin.local");
    const listener = vi.fn();
    connection.onLog(listener);

    FakeWebSocket.latest.receive(
      encodeLog(0xdeadbeef, 42, "System ready\n", 98_765_432_101n),
    );

    expect(listener).toHaveBeenCalledOnce();
    const [chunk] = listener.mock.calls[0];
    expect(chunk.boot).toBe(0xdeadbeef);
    expect(chunk.position).toBe(42);
    expect(chunk.uptimeUs).toBe(98_765_432_101);
    expect(new TextDecoder().decode(chunk.text)).toBe("System ready\n");
  });

  it("stops handing over the log once unsubscribed", () => {
    const connection = new PumpkinConnection("pumpkin.local");
    const listener = vi.fn();
    connection.onLog(listener)();

    FakeWebSocket.latest.receive(encodeLog(1, 0, "unheard\n"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("says when its socket opens", () => {
    const connection = new PumpkinConnection("pumpkin.local");
    const listener = vi.fn();
    connection.onConnect(listener);

    FakeWebSocket.latest.open();

    expect(listener).toHaveBeenCalledOnce();
    expect(connection.isOpen).toBe(true);
  });

  it("hands news the device sends unasked to whoever listens for it", () => {
    const connection = new PumpkinConnection("pumpkin.local");
    const listener = vi.fn();
    connection.onNotice(ServerPayload.AutoModeStatus, listener);
    FakeWebSocket.latest.open();

    FakeWebSocket.latest.receive(
      encodeServerMessage(0, ServerPayload.AutoModeStatus, (builder) =>
        AutoModeStatus.createAutoModeStatus(builder, false, 15, 45),
      ),
    );

    expect(listener).toHaveBeenCalledExactlyOnceWith({
      running: false,
      minPauseS: 15,
      maxPauseS: 45,
    });
  });
});
