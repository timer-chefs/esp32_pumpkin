import { stopAudio } from "./audio_cleanup.ts";

import { processAudioFile } from "./audio_file_processor.ts";

import { streamAudioData } from "./audio_streamer.ts";

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

export function onFileSelected(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  selectedFile = input.files?.[0] ?? null;

  if (selectedFile) {
    const sizeMegabytes = (selectedFile.size / 1024 / 1024).toFixed(2);
    setFileStatus(
      `<p>Selected: <strong>${selectedFile.name}</strong> (${sizeMegabytes} MB)</p>`,
    );
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
    await fetch("/api/audio/reset");
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
