export type AudioPanel = "microphone" | "file";
export type StatusTone = "neutral" | "success";

export interface AudioUiState {
  activePanel: AudioPanel | null;
  currentMode: string;
  currentStreaming: string | null;
  fileStatus: { message: string; tone: StatusTone } | null;
  folderStatus: "success" | "error" | null;
  streamFileEnabled: boolean;
  volume: number;
}

let state: AudioUiState = {
  activePanel: null,
  currentMode: "Idle",
  currentStreaming: null,
  fileStatus: null,
  folderStatus: null,
  streamFileEnabled: false,
  volume: 1,
};

const listeners = new Set<() => void>();

export function getAudioUiState(): AudioUiState {
  return state;
}

export function subscribeToAudioUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showMicrophoneMode(): void {
  updateState({ activePanel: "microphone" });
}

export function hideMicrophoneMode(): void {
  if (state.activePanel === "microphone") {
    updateState({ activePanel: null });
  }
}

export function showFileMode(): void {
  updateState({ activePanel: "file" });
}

export function setFileStatus(
  message: string,
  tone: StatusTone = "neutral",
): void {
  updateState({ fileStatus: { message, tone } });
}

export function clearFileStatus(): void {
  updateState({ fileStatus: null });
}

export function setStreamFileEnabled(enabled: boolean): void {
  updateState({ streamFileEnabled: enabled });
}

export function setCurrentMode(mode: string): void {
  updateState({ currentMode: mode });
}

export function setCurrentStreamingEnabled(enabled: boolean): void {
  if (!enabled) {
    updateState({ currentStreaming: null });
  }
}

export function setCurrentStreaming(description: string): void {
  updateState({ currentStreaming: description });
}

export function setFolderStatus(success: boolean): void {
  updateState({ folderStatus: success ? "success" : "error" });
}

export function setVolumeDisplay(volume: number): void {
  updateState({ volume });
}

function updateState(update: Partial<AudioUiState>): void {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}
