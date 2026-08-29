export interface AudioSocketHandlers {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

let sharedSocket: WebSocket | null = null;

function createAudioSocket(
  hostname: string,
  handlers: AudioSocketHandlers = {},
): WebSocket {
  const websocketUrl = import.meta.env.DEV
    ? `ws://${hostname}:${location.port}/ws`
    : `ws://${hostname}:81/`;
  const socket = new WebSocket(websocketUrl);
  socket.binaryType = "arraybuffer";

  if (handlers.onOpen) {
    socket.onopen = handlers.onOpen;
  }
  if (handlers.onClose) {
    socket.onclose = handlers.onClose;
  }
  if (handlers.onError) {
    socket.onerror = handlers.onError;
  }

  return socket;
}

export function getAudioSocket(hostname: string): WebSocket {
  if (
    !sharedSocket ||
    sharedSocket.readyState === WebSocket.CLOSING ||
    sharedSocket.readyState === WebSocket.CLOSED
  ) {
    sharedSocket = createAudioSocket(hostname);
  }

  return sharedSocket;
}

export function waitForAudioSocket(
  socket: WebSocket,
  signal?: AbortSignal,
): Promise<WebSocket> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve(socket);
  }

  if (signal?.aborted) {
    return Promise.reject(
      new DOMException("Audio session stopped", "AbortError"),
    );
  }

  if (
    socket.readyState === WebSocket.CLOSING ||
    socket.readyState === WebSocket.CLOSED
  ) {
    return Promise.reject(new Error("Audio WebSocket is closed"));
  }

  return new Promise<WebSocket>((resolve, reject) => {
    const cleanup = () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
      signal?.removeEventListener("abort", onAbort);
    };
    const onOpen = () => {
      cleanup();
      resolve(socket);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Audio WebSocket error"));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Audio WebSocket closed before connecting"));
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

export function isSocketOpen(
  socket: WebSocket | null | undefined,
): socket is WebSocket {
  return socket?.readyState === WebSocket.OPEN;
}
