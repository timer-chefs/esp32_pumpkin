export function createAudioSocket(hostname, handlers = {}) {
  const wsUrl = import.meta.env.DEV
    ? `ws://${hostname}:${location.port}/ws`
    : `ws://${hostname}:81/`;
  const socket = new WebSocket(wsUrl);
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

export function isSocketOpen(socket) {
  return socket && socket.readyState === WebSocket.OPEN;
}

export function closeAudioSocket(socket) {
  if (!socket) {
    return;
  }

  if (socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }
}
