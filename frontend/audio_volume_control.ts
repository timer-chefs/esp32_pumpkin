import { setVolumeDisplay } from "./audio_ui.ts";

let volume = 0.5;

export async function increaseVolume(): Promise<void> {
  volume = await fetchVolume("/api/audio/volume/up", { method: "POST" });
  setVolumeDisplay(volume);
}

export async function decreaseVolume(): Promise<void> {
  volume = await fetchVolume("/api/audio/volume/down", { method: "POST" });
  setVolumeDisplay(volume);
}

export async function loadVolume(): Promise<void> {
  volume = await fetchVolume("/api/audio/volume");
  setVolumeDisplay(volume);
}

async function fetchVolume(url: string, init?: RequestInit): Promise<number> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Volume request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isVolumeResponse(data)) {
    throw new Error("Volume response did not contain a numeric volume");
  }

  return data.volume;
}

function isVolumeResponse(data: unknown): data is { volume: number } {
  return (
    typeof data === "object" &&
    data !== null &&
    "volume" in data &&
    typeof data.volume === "number"
  );
}
