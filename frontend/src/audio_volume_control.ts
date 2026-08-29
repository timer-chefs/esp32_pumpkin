import { getAudioSocket, waitForAudioSocket } from "./audio_socket.ts";
import { setVolumeDisplay } from "./audio_ui.ts";
import { adjustVolume, getVolume } from "./protocol_client.ts";

let volume = 0.5;

export async function increaseVolume(): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  volume = await adjustVolume(socket, 0.1);
  setVolumeDisplay(volume);
}

export async function decreaseVolume(): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  volume = await adjustVolume(socket, -0.1);
  setVolumeDisplay(volume);
}

export async function loadVolume(): Promise<void> {
  const socket = await waitForAudioSocket(getAudioSocket(location.hostname));
  volume = await getVolume(socket);
  setVolumeDisplay(volume);
}
