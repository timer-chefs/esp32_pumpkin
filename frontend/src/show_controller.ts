import { getAudioSocket, waitForAudioSocket } from "./audio_socket.ts";
import type { PresetShow } from "./preset_shows.ts";
import { playShow as sendPlayShowCommand } from "./protocol_client.ts";
import { streamShowAudio } from "./show_audio.ts";

export async function playShow(show: PresetShow): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  sendPlayShowCommand(socket, show.id);
  await streamShowAudio(show);
}
