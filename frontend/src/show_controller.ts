import { streamAudioFile } from "./audio_file_controller.ts";
import { getAudioSocket, waitForAudioSocket } from "./audio_socket.ts";
import { getAudioFile } from "./folder_manager.ts";
import type { PresetShow } from "./preset_shows.ts";
import { playShow as sendPlayShowCommand } from "./protocol_client.ts";

export async function playShow(show: PresetShow): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  sendPlayShowCommand(socket, show.id);

  try {
    const file = await getAudioFile(show.file);
    await streamAudioFile(file);
  } catch (error) {
    console.error("Failed to stream show audio:", error);
    alert(
      `Error: Could not load audio file "${show.file}". Make sure it exists in the selected folder.`,
    );
  }
}
