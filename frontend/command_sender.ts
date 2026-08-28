export interface AudioCommand {
  command: string;
  [property: string]: unknown;
}

export function sendCommand(socket: WebSocket, command: AudioCommand): void {
  socket.send(JSON.stringify(command));
}
