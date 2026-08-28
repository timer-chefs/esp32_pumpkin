import { stopAudio } from "./audio_cleanup.ts";
import {
  onFileSelected,
  streamSelectedFile,
  switchToFile,
} from "./audio_file_controller.ts";
import { getElement } from "./audio_ui.ts";
import {
  decreaseVolume,
  increaseVolume,
  loadVolume,
} from "./audio_volume_control.ts";
import { handleSelectAudioFolder } from "./folder_manager.ts";
import { stopMicrophone, switchToMicrophone } from "./microphone_controller.ts";
import { presetShows } from "./preset_shows.ts";
import { playShow } from "./show_controller.ts";

const ghostShow = presetShows.find((show) => show.name === "Ghost");
if (!ghostShow) {
  throw new Error('Expected a preset show named "Ghost"');
}

onClick("btn-microphone", switchToMicrophone);
onClick("btn-stop-microphone", stopMicrophone);
onClick("btn-file", switchToFile);
onClick("btn-stream", streamSelectedFile);
onClick("btn-stop-file", stopAudio);
onClick("btn-volume-up", increaseVolume);
onClick("btn-volume-down", decreaseVolume);
onClick("btn-show-ghost", () => playShow(ghostShow));
onClick("btn-select-audio-folder", handleSelectAudioFolder);

getElement<HTMLInputElement>("audio-file").addEventListener(
  "change",
  onFileSelected,
);

runAction(loadVolume);

function onClick(id: string, action: () => void | Promise<void>): void {
  getElement<HTMLButtonElement>(id).addEventListener("click", () => {
    runAction(action);
  });
}

function runAction(action: () => void | Promise<void>): void {
  try {
    Promise.resolve(action()).catch(reportActionError);
  } catch (error) {
    reportActionError(error);
  }
}

function reportActionError(error: unknown): void {
  console.error("Action failed:", error);
}
