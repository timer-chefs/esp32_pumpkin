import { streamAudioFile } from "./audio_file_controller.ts";
import { getAudioFile } from "./folder_manager.ts";
import type { PresetShow } from "./preset_shows.ts";

export async function streamShowAudio(show: PresetShow): Promise<void> {
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
