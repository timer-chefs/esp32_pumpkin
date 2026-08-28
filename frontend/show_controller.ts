import { createAudioSocket } from "./audio_socket.ts";
import { sendCommand } from "./command_sender.ts";
import type { PresetShow } from "./preset_shows.ts";
import { streamShowAudio } from "./show_audio.ts";

export async function playShow(show: PresetShow): Promise<void> {
  await sendPlayShow(show);
  await streamShowAudio(show);
}

async function sendPlayShow(show: PresetShow): Promise<void> {
  await new Promise<void>((resolve) => {
    const socket = createAudioSocket(location.hostname);

    socket.onopen = () => {
      sendCommand(socket, { command: "PLAY_SHOW", show: show.id });
      setTimeout(() => socket.close(), 100);
    };

    socket.onclose = () => {
      clearHandlers(socket);
      resolve();
    };

    socket.onerror = () => {
      clearHandlers(socket);
      socket.close();
      resolve();
    };
  });
}

function clearHandlers(socket: WebSocket): void {
  socket.onopen = null;
  socket.onclose = null;
  socket.onerror = null;
}
