import { useEffect, useSyncExternalStore } from "react";

import { stopAudio } from "./audio_cleanup.ts";
import {
  onFileSelected,
  streamSelectedFile,
  switchToFile,
} from "./audio_file_controller.ts";
import { getAudioUiState, subscribeToAudioUi } from "./audio_ui.ts";
import {
  decreaseVolume,
  increaseVolume,
  loadVolume,
} from "./audio_volume_control.ts";
import { handleSelectAudioFolder } from "./folder_manager.ts";
import { stopMicrophone, switchToMicrophone } from "./microphone_controller.ts";
import { presetShows } from "./preset_shows.ts";
import type { PresetShow } from "./preset_shows.ts";
import { playShow } from "./show_controller.ts";

const ghostShow = getPresetShow("Ghost");

export function useAppController() {
  const state = useSyncExternalStore(
    subscribeToAudioUi,
    getAudioUiState,
    getAudioUiState,
  );

  useEffect(() => {
    runAction(loadVolume);
  }, []);

  return {
    state,
    actions: {
      decreaseVolume: () => runAction(decreaseVolume),
      increaseVolume: () => runAction(increaseVolume),
      playGhostShow: () => runAction(() => playShow(ghostShow)),
      selectAudioFile: onFileSelected,
      selectAudioFolder: () => runAction(handleSelectAudioFolder),
      startFile: () => runAction(streamSelectedFile),
      startFileMode: () => runAction(switchToFile),
      startMicrophone: () => runAction(switchToMicrophone),
      stopAudio: () => runAction(stopAudio),
      stopMicrophone: () => runAction(stopMicrophone),
    },
  };
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

function getPresetShow(name: string): PresetShow {
  const show = presetShows.find((preset) => preset.name === name);
  if (!show) {
    throw new Error(`Expected a preset show named "${name}"`);
  }

  return show;
}
