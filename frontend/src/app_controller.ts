import { useEffect, useSyncExternalStore } from "react";

import { streamAudioFile } from "./audio_file.ts";
import { audioSessionManager, type AudioSession } from "./audio_session.ts";
import {
  getPumpkinConnection,
  type PumpkinConnection,
} from "./pumpkin_connection.ts";
import api, { type AudioFileInfo } from "./pumpkin_client.ts";
import { toError } from "./to_error.ts";
import workletUrl from "./worklet_processor.ts?worker&url";

export type AudioSource = "microphone" | "file" | "sdCard";
export type MicrophoneStatus = "starting" | "streaming";
export type StatusTone = "neutral" | "success";

export interface AppState {
  activeSource: AudioSource | null;
  currentMode: string;
  currentStreaming: string | null;
  fileStatus: { message: string; tone: StatusTone } | null;
  folderStatus: "success" | "error" | null;
  microphoneStatus: MicrophoneStatus | null;
  playingSdCardFile: string | null;
  sdCardError: string | null;
  // Null until the card has been listed for the first time.
  sdCardFiles: AudioFileInfo[] | null;
  sdCardLoading: boolean;
  streamFileEnabled: boolean;
  volume: number | null;
}

interface ReadableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(): Promise<ReadableDirectoryHandle>;
}

const GHOST_SHOW = { id: 1, audioFile: "ghost.wav" };

let state: AppState = {
  activeSource: null,
  currentMode: "Idle",
  currentStreaming: null,
  fileStatus: null,
  folderStatus: null,
  microphoneStatus: null,
  playingSdCardFile: null,
  sdCardError: null,
  sdCardFiles: null,
  sdCardLoading: false,
  streamFileEnabled: false,
  volume: null,
};
let selectedFile: File | null = null;
let selectedFolder: ReadableDirectoryHandle | null = null;

const listeners = new Set<() => void>();

const actions = {
  decreaseVolume: () => runAction(() => changeVolume(-0.1)),
  increaseVolume: () => runAction(() => changeVolume(0.1)),
  playGhostShow: () => runAction(playGhostShow),
  playSdCardFile: (name: string) => runAction(() => playSdCardFile(name)),
  refreshSdCardFiles: () => runAction(refreshSdCardFiles),
  selectAudioFile,
  selectAudioFolder: () => runAction(selectAudioFolder),
  startFile: () => runAction(startSelectedFile),
  startFileMode: () => runAction(startFileMode),
  startMicrophone: () => runAction(startMicrophone),
  startSdCardMode: () => runAction(startSdCardMode),
  stopAudio: () => runAction(stopAudio),
  stopMicrophone: () => runAction(stopMicrophone),
  stopSdCardPlayback: () => runAction(stopSdCardPlayback),
};

export type AppActions = typeof actions;

export interface AppController {
  state: AppState;
  actions: AppActions;
}

export function useAppController(): AppController {
  const currentState = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    getPumpkinConnection(location.hostname);
    runAction(loadVolume);
  }, []);

  return { state: currentState, actions };
}

function getState(): AppState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateState(update: Partial<AppState>): void {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}

async function stopAudio(): Promise<void> {
  await audioSessionManager.stop();
  await tellDeviceToStopSdCardPlayback();
  updateState({
    currentMode: "Idle",
    currentStreaming: null,
    fileStatus: null,
    microphoneStatus: null,
    playingSdCardFile: null,
  });
}

async function startFileMode(): Promise<void> {
  await stopAudio();
  updateState({ activeSource: "file", currentMode: "Audio File" });
}

function selectAudioFile(file: File | null): void {
  selectedFile = file;
  updateState({
    fileStatus: file
      ? {
          message: `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
          tone: "neutral",
        }
      : null,
    streamFileEnabled: file !== null,
  });
}

async function startSelectedFile(): Promise<void> {
  const file = selectedFile;
  if (!file) {
    alert("Please select an audio file first");
    return;
  }

  await resetAudioBuffer();

  try {
    await streamFile(file);
    updateState({ currentStreaming: file.name });
  } catch (error) {
    console.error("Could not stream audio file:", error);
    alert("Failed to process audio file. Make sure it's a valid audio file.");
  }
}

async function startMicrophone(): Promise<void> {
  await stopAudio();
  updateState({
    activeSource: "microphone",
    currentMode: "Starting microphone",
    microphoneStatus: "starting",
  });

  let session: AudioSession | null = null;
  try {
    session = await audioSessionManager.start({
      onError: (error) => console.error("Microphone session error:", error),
    });

    const mediaStream = await requestMicrophone();
    if (!audioSessionManager.isActive(session)) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return;
    }
    session.attachMediaStream(mediaStream);

    const audioContext = new AudioContext({ sampleRate: 16_000 });
    session.attachAudioContext(audioContext);
    await audioContext.audioWorklet.addModule(workletUrl);

    if (!audioSessionManager.isActive(session)) {
      return;
    }

    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    const processorNode = new AudioWorkletNode(audioContext, "pcm-processor");
    session.attachSourceNode(sourceNode);
    session.attachProcessorNode(processorNode);
    processorNode.port.onmessage = (event) => session?.send(event.data);
    sourceNode.connect(processorNode);

    updateState({
      currentMode: "Microphone",
      currentStreaming: "Microphone",
      microphoneStatus: "streaming",
    });
  } catch (error) {
    console.error("Could not start microphone streaming:", error);
    if (session) {
      await audioSessionManager.stop(session, { notifyServer: false });
    }
    if (state.activeSource === "microphone") {
      updateState({
        activeSource: null,
        currentMode: "Idle",
        currentStreaming: null,
        microphoneStatus: null,
      });
    }
  }
}

async function stopMicrophone(): Promise<void> {
  await stopAudio();
  updateState({ activeSource: null });
}

async function requestMicrophone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    alert("Microphone access failed.");
    throw error;
  }
}

async function startSdCardMode(): Promise<void> {
  await stopAudio();
  updateState({ activeSource: "sdCard", currentMode: "SD card" });
  await refreshSdCardFiles();
}

async function refreshSdCardFiles(): Promise<void> {
  updateState({ sdCardError: null, sdCardLoading: true });

  try {
    const files = await api.listAudioFiles(await getOpenConnection());
    updateState({ sdCardFiles: files, sdCardLoading: false });
  } catch (error) {
    console.error("Could not list the SD card:", error);
    updateState({
      sdCardError: "Could not read the SD card",
      sdCardLoading: false,
    });
  }
}

async function playSdCardFile(name: string): Promise<void> {
  // The device plays this one on its own, so hand back whatever the browser
  // was streaming before asking for it.
  await audioSessionManager.stop();

  try {
    await api.playAudioFile(await getOpenConnection(), name);
    updateState({
      currentMode: "SD card",
      currentStreaming: name,
      playingSdCardFile: name,
      sdCardError: null,
    });
  } catch (error) {
    console.error(`Could not play "${name}" from the SD card:`, error);
    updateState({
      playingSdCardFile: null,
      sdCardError: toError(error).message,
    });
  }
}

async function stopSdCardPlayback(): Promise<void> {
  await tellDeviceToStopSdCardPlayback();
  updateState({ currentStreaming: null, playingSdCardFile: null });
}

async function tellDeviceToStopSdCardPlayback(): Promise<void> {
  if (!state.playingSdCardFile) {
    return;
  }

  try {
    api.stopAudioStream(await getOpenConnection());
  } catch (error) {
    console.warn("Could not stop SD card playback:", error);
  }
}

async function selectAudioFolder(): Promise<void> {
  try {
    const folder = await (
      window as unknown as DirectoryPickerWindow
    ).showDirectoryPicker();
    if ((await folder.queryPermission({ mode: "read" })) !== "granted") {
      const permission = await folder.requestPermission({ mode: "read" });
      if (permission !== "granted") {
        throw new Error("Permission denied");
      }
    }

    selectedFolder = folder;
    updateState({ folderStatus: "success" });
  } catch (error) {
    console.error("Folder selection failed:", error);
    updateState({ folderStatus: "error" });
  }
}

async function playGhostShow(): Promise<void> {
  const connection = await getOpenConnection();
  api.playShow(connection, GHOST_SHOW.id);

  try {
    const file = await getAudioFile(GHOST_SHOW.audioFile);
    await streamFile(file);
  } catch (error) {
    console.error("Failed to stream show audio:", error);
    alert(
      `Could not load "${GHOST_SHOW.audioFile}". Make sure it exists in the selected folder.`,
    );
  }
}

async function getAudioFile(fileName: string): Promise<File> {
  if (!selectedFolder) {
    throw new Error("No audio folder selected");
  }

  const fileHandle = await selectedFolder.getFileHandle(fileName);
  return fileHandle.getFile();
}

async function streamFile(file: File): Promise<void> {
  await streamAudioFile(file, (message, tone = "neutral") => {
    updateState({ fileStatus: { message, tone } });
  });
}

async function loadVolume(): Promise<void> {
  const volume = await api.getVolume(await getOpenConnection());
  updateState({ volume });
}

async function changeVolume(delta: number): Promise<void> {
  const volume = await api.adjustVolume(await getOpenConnection(), delta);
  updateState({ volume });
}

async function resetAudioBuffer(): Promise<void> {
  try {
    await api.resetAudio(await getOpenConnection());
  } catch (error) {
    console.warn("Could not reset audio buffer:", error);
  }
}

async function getOpenConnection(): Promise<PumpkinConnection> {
  const connection = getPumpkinConnection(location.hostname);
  await connection.waitUntilOpen();
  return connection;
}

function runAction(action: () => void | Promise<void>): void {
  try {
    Promise.resolve(action()).catch((error) =>
      console.error("Action failed:", error),
    );
  } catch (error) {
    console.error("Action failed:", error);
  }
}
