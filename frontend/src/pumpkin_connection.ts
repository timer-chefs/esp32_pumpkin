import * as flatbuffers from "flatbuffers";

import {
  ClientMessage,
  ClientPayload,
  Error as ProtocolError,
  Message,
  MessageBody,
  ServerMessage,
  ServerPayload,
  Volume,
} from "./generated/pumpkin/protocol.ts";
import { toError } from "./to_error.ts";

type CreatePayload = (builder: flatbuffers.Builder) => flatbuffers.Offset;

// decodeResponse only ever populates `value` for ServerPayload.Volume, so
// that's the only payload sendRequest's callers can resolve a number for.
type ResponseValue<Payload extends ServerPayload> =
  Payload extends ServerPayload.Volume ? number : void;

interface PendingRequest {
  expectedPayload: ServerPayload;
  resolve: (value: number | undefined) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type DisconnectReason = "close" | "error";
type DisconnectListener = (reason: DisconnectReason) => void;

const REQUEST_TIMEOUT_MS = 5000;

/** Owns the WebSocket to the pumpkin device, reconnecting as needed and tracking in-flight requests. */
export class PumpkinConnection {
  private socket: WebSocket;
  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly disconnectListeners = new Set<DisconnectListener>();
  private nextRequestId = 1;

  constructor(private readonly hostname: string) {
    this.socket = this.createSocket();
  }

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  /** Reconnects if necessary, then resolves once the socket is open. */
  waitUntilOpen(signal?: AbortSignal): Promise<void> {
    if (
      this.socket.readyState === WebSocket.CLOSING ||
      this.socket.readyState === WebSocket.CLOSED
    ) {
      // The current socket is on its way out and about to be replaced.
      // Tell subscribers now rather than waiting for its close event, which
      // by the time it fires will target a socket that's no longer current
      // and would otherwise be silently ignored (see handleDisconnect).
      this.handleCurrentSocketLost("close");
      this.socket = this.createSocket();
    }

    const socket = this.socket;
    if (socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (signal?.aborted) {
      return Promise.reject(
        new DOMException("Audio session stopped", "AbortError"),
      );
    }

    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        signal?.removeEventListener("abort", onAbort);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Pumpkin WebSocket error"));
      };
      const onClose = () => {
        cleanup();
        reject(new Error("Pumpkin WebSocket closed before connecting"));
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException("Audio session stopped", "AbortError"));
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onClose);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Subscribes to disconnects of the connection's *current* socket, staying
   * correct across reconnects (unlike listening on a socket directly, which
   * goes stale the moment the connection swaps in a new one). Returns an
   * unsubscribe function.
   */
  onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  sendMessage(payloadType: ClientPayload, createPayload: CreatePayload): void {
    this.socket.send(this.encodeMessage(payloadType, createPayload, 0));
  }

  sendRequest<Payload extends ServerPayload>(
    payloadType: ClientPayload,
    createPayload: CreatePayload,
    expectedPayload: Payload,
  ): Promise<ResponseValue<Payload>> {
    const requestId = this.allocateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`WebSocket request ${requestId} timed out`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        expectedPayload,
        resolve: resolve as (value: number | undefined) => void,
        reject,
        timeout,
      });

      try {
        this.socket.send(
          this.encodeMessage(payloadType, createPayload, requestId),
        );
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(toError(error));
      }
    });
  }

  private createSocket(): WebSocket {
    const websocketUrl = import.meta.env.DEV
      ? `ws://${this.hostname}:${location.port}/ws`
      : `ws://${this.hostname}:81/`;
    const socket = new WebSocket(websocketUrl);
    socket.binaryType = "arraybuffer";

    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("close", () =>
      this.handleDisconnect(socket, "close"),
    );
    socket.addEventListener("error", () =>
      this.handleDisconnect(socket, "error"),
    );

    return socket;
  }

  private handleMessage(event: MessageEvent): void {
    if (!(event.data instanceof ArrayBuffer)) {
      return;
    }

    const response = decodeResponse(new Uint8Array(event.data));
    if (!response) {
      return;
    }

    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.error) {
      pending.reject(response.error);
    } else if (response.payloadType !== pending.expectedPayload) {
      pending.reject(new Error("WebSocket response had an unexpected type"));
    } else {
      pending.resolve(response.value);
    }
  }

  // A superseded socket (replaced by waitUntilOpen while reconnecting) can
  // still fire a belated close/error event; ignore it so it can't reject
  // requests that were actually sent on the socket that replaced it, or
  // double-report a loss that waitUntilOpen already announced.
  private handleDisconnect(socket: WebSocket, reason: DisconnectReason): void {
    if (this.socket === socket) {
      this.handleCurrentSocketLost(reason);
    }
  }

  private handleCurrentSocketLost(reason: DisconnectReason): void {
    if (reason === "close") {
      this.rejectAllPending(
        new Error("WebSocket closed before the request completed"),
      );
    }

    this.disconnectListeners.forEach((listener) => listener(reason));
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private allocateRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId =
      this.nextRequestId === 0xffffffff ? 1 : this.nextRequestId + 1;
    return requestId;
  }

  private encodeMessage(
    payloadType: ClientPayload,
    createPayload: CreatePayload,
    requestId: number,
  ): ArrayBuffer {
    const builder = new flatbuffers.Builder(1024);
    const payloadOffset = createPayload(builder);
    const clientMessage = ClientMessage.createClientMessage(
      builder,
      requestId,
      payloadType,
      payloadOffset,
    );
    const message = Message.createMessage(
      builder,
      MessageBody.ClientMessage,
      clientMessage,
    );
    Message.finishMessageBuffer(builder, message);
    const encoded = builder.asUint8Array();
    const owned = new Uint8Array(encoded.byteLength);
    owned.set(encoded);
    return owned.buffer;
  }
}

let sharedConnection: PumpkinConnection | null = null;
let sharedConnectionHostname: string | null = null;

/** Returns the single shared connection to the pumpkin device, creating it on first use. */
export function getPumpkinConnection(hostname: string): PumpkinConnection {
  if (!sharedConnection) {
    sharedConnection = new PumpkinConnection(hostname);
    sharedConnectionHostname = hostname;
  } else if (hostname !== sharedConnectionHostname) {
    console.warn(
      `Ignoring hostname "${hostname}": already connected to "${sharedConnectionHostname}".`,
    );
  }
  return sharedConnection;
}

function decodeResponse(data: Uint8Array):
  | {
      requestId: number;
      payloadType: ServerPayload;
      value?: number;
      error?: Error;
    }
  | undefined {
  const buffer = new flatbuffers.ByteBuffer(data);
  if (!Message.bufferHasIdentifier(buffer)) {
    return undefined;
  }

  const message = Message.getRootAsMessage(buffer);
  if (message.bodyType() !== MessageBody.ServerMessage) {
    return undefined;
  }

  const serverMessage = message.body(
    new ServerMessage(),
  ) as ServerMessage | null;
  if (!serverMessage) {
    return undefined;
  }

  const payloadType = serverMessage.payloadType();
  if (payloadType === ServerPayload.Error) {
    const payload = serverMessage.payload(new ProtocolError()) as ProtocolError;
    return {
      requestId: serverMessage.requestId(),
      payloadType,
      error: new Error(payload.message() ?? "Unknown device error"),
    };
  }

  if (payloadType === ServerPayload.Volume) {
    const payload = serverMessage.payload(new Volume()) as Volume;
    return {
      requestId: serverMessage.requestId(),
      payloadType,
      value: payload.value(),
    };
  }

  return { requestId: serverMessage.requestId(), payloadType };
}
