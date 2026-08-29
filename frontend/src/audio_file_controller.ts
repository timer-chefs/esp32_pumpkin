import { stopAudio } from "./audio_cleanup.ts";

import { processAudioFile } from "./audio_file_processor.ts";

import { streamAudioData } from "./audio_streamer.ts";
import { getAudioSocket, waitForAudioSocket } from "./audio_socket.ts";
import { resetAudio } from "./protocol_client.ts";

import {
  clearFileStatus,
  setCurrentMode,
  setCurrentStreaming,
  setFileStatus,
  setStreamFileEnabled,
  showFileMode,
} from "./audio_ui.ts";

let selectedFile: File | null = null;

export async function switchToFile(): Promise<void> {
  await stopAudio();
  showFileMode();
  setCurrentMode("Audio File");
}

export function onFileSelected(file: File | null): void {
  selectedFile = file;

  if (selectedFile) {
    const sizeMegabytes = (selectedFile.size / 1024 / 1024).toFixed(2);
    setFileStatus(`Selected: ${selectedFile.name} (${sizeMegabytes} MB)`);
    setStreamFileEnabled(true);
  } else {
    clearFileStatus();
    setStreamFileEnabled(false);
  }
}

export async function streamSelectedFile(): Promise<void> {
  const file = selectedFile;
  if (!file) {
    alert("Please select an audio file first");
    return;
  }

  try {
    const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
    await resetAudio(socket);
  } catch (error) {
    console.warn("Could not reset audio buffer:", error);
  }

  try {
    await streamAudioFile(file);
    setCurrentStreaming(file.name);
  } catch (error) {
    console.error("Could not stream audio file:", error);
    alert("Failed to process audio file. Make sure it's a valid audio file.");
  }
}

export async function streamAudioFile(file: File): Promise<void> {
  const pcm = await processAudioFile(file);
  await streamAudioData(pcm.buffer);
}
