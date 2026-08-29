import { getAudioSocket, waitForAudioSocket } from "./audio_socket.ts";
import { sendCommand } from "./command_sender.ts";
import type { PresetShow } from "./preset_shows.ts";
import { streamShowAudio } from "./show_audio.ts";

export async function playShow(show: PresetShow): Promise<void> {
  await sendPlayShow(show);
  await streamShowAudio(show);
}

async function sendPlayShow(show: PresetShow): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  sendCommand(socket, { command: "PLAY_SHOW", show: show.id });
}
