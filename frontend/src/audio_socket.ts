export interface AudioSocketHandlers {
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export function createAudioSocket(
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

export function isSocketOpen(
  socket: WebSocket | null | undefined,
): socket is WebSocket {
  return socket?.readyState === WebSocket.OPEN;
}

export function closeAudioSocket(socket: WebSocket | null | undefined): void {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }
}
