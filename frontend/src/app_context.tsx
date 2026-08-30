import { createContext, type PropsWithChildren, useContext } from "react";

import type { AppActions, AppController, AppState } from "./app_controller.ts";

const AppContext = createContext<AppController | null>(null);

export interface AppContextProviderProps extends PropsWithChildren {
  value: AppController;
}

export function AppContextProvider({
  children,
  value,
}: AppContextProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useAppContext(): AppController {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
}

export interface AppStatus {
  currentMode: AppState["currentMode"];
  currentStreaming: AppState["currentStreaming"];
}

export function useAppStatus(): AppStatus {
  const { state } = useAppContext();
  return {
    currentMode: state.currentMode,
    currentStreaming: state.currentStreaming,
  };
}

export interface AudioSourceControls {
  activeSource: AppState["activeSource"];
  fileStatus: AppState["fileStatus"];
  microphoneStatus: AppState["microphoneStatus"];
  streamFileEnabled: AppState["streamFileEnabled"];
  selectAudioFile: AppActions["selectAudioFile"];
  startFile: AppActions["startFile"];
  startFileMode: AppActions["startFileMode"];
  startMicrophone: AppActions["startMicrophone"];
  stopAudio: AppActions["stopAudio"];
  stopMicrophone: AppActions["stopMicrophone"];
}

export function useAudioSource(): AudioSourceControls {
  const { state, actions } = useAppContext();
  return {
    activeSource: state.activeSource,
    fileStatus: state.fileStatus,
    microphoneStatus: state.microphoneStatus,
    streamFileEnabled: state.streamFileEnabled,
    selectAudioFile: actions.selectAudioFile,
    startFile: actions.startFile,
    startFileMode: actions.startFileMode,
    startMicrophone: actions.startMicrophone,
    stopAudio: actions.stopAudio,
    stopMicrophone: actions.stopMicrophone,
  };
}

export interface PresetShowControls {
  folderStatus: AppState["folderStatus"];
  playGhostShow: AppActions["playGhostShow"];
  selectAudioFolder: AppActions["selectAudioFolder"];
}

export function usePresetShows(): PresetShowControls {
  const { state, actions } = useAppContext();
  return {
    folderStatus: state.folderStatus,
    playGhostShow: actions.playGhostShow,
    selectAudioFolder: actions.selectAudioFolder,
  };
}

export interface VolumeControls {
  volume: AppState["volume"];
  decrease: AppActions["decreaseVolume"];
  increase: AppActions["increaseVolume"];
}

export function useVolume(): VolumeControls {
  const { state, actions } = useAppContext();
  return {
    volume: state.volume,
    decrease: actions.decreaseVolume,
    increase: actions.increaseVolume,
  };
}
