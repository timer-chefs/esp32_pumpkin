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
} from "./generated/pumpkin_generated.ts";

interface PendingRequest {
  expectedPayload: ServerPayload;
  resolve: (value: number | undefined) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingRequests = new WeakMap<WebSocket, Map<number, PendingRequest>>();
let nextRequestId = 1;

export type CreatePayload = (
  builder: flatbuffers.Builder,
) => flatbuffers.Offset;

export function sendMessage(
  socket: WebSocket,
  payloadType: ClientPayload,
  createPayload: CreatePayload,
): void {
  socket.send(encodeMessage(payloadType, createPayload, 0));
}

export function sendRequest(
  socket: WebSocket,
  payloadType: ClientPayload,
  createPayload: CreatePayload,
  expectedPayload: ServerPayload,
): Promise<number | undefined> {
  const requestId = allocateRequestId();
  const requests = getPendingRequests(socket);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      requests.delete(requestId);
      reject(new Error(`WebSocket request ${requestId} timed out`));
    }, 5000);

    requests.set(requestId, { expectedPayload, resolve, reject, timeout });

    try {
      socket.send(encodeMessage(payloadType, createPayload, requestId));
    } catch (error) {
      clearTimeout(timeout);
      requests.delete(requestId);
      reject(toError(error));
    }
  });
}

function getPendingRequests(socket: WebSocket): Map<number, PendingRequest> {
  const existing = pendingRequests.get(socket);
  if (existing) {
    return existing;
  }

  const requests = new Map<number, PendingRequest>();
  pendingRequests.set(socket, requests);

  socket.addEventListener("message", (event) => {
    if (!(event.data instanceof ArrayBuffer)) {
      return;
    }

    const response = decodeResponse(new Uint8Array(event.data));
    if (!response) {
      return;
    }

    const pending = requests.get(response.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    requests.delete(response.requestId);

    if (response.error) {
      pending.reject(response.error);
    } else if (response.payloadType !== pending.expectedPayload) {
      pending.reject(new Error("WebSocket response had an unexpected type"));
    } else {
      pending.resolve(response.value);
    }
  });

  socket.addEventListener("close", () => {
    for (const pending of requests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new Error("WebSocket closed before the request completed"),
      );
    }
    requests.clear();
  });

  return requests;
}

function encodeMessage(
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

function allocateRequestId(): number {
  const requestId = nextRequestId;
  nextRequestId = nextRequestId === 0xffffffff ? 1 : nextRequestId + 1;
  return requestId;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
