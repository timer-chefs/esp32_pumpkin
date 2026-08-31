import {
  AdjustVolume,
  AudioChunk,
  ClientPayload,
  GetVolume,
  PlayShow,
  ResetAudio,
  ServerPayload,
  StartAudioStream,
  StopAudioStream,
} from "./generated/pumpkin_generated.ts";
import { sendMessage, sendRequest } from "./protocol_client.ts";

export default class PumpkinClient {
  static startAudioStream(socket: WebSocket): void {
    sendMessage(socket, ClientPayload.StartAudioStream, (builder) =>
      StartAudioStream.createStartAudioStream(builder),
    );
  }

  static stopAudioStream(socket: WebSocket): void {
    sendMessage(socket, ClientPayload.StopAudioStream, (builder) =>
      StopAudioStream.createStopAudioStream(builder),
    );
  }

  static playShow(socket: WebSocket, show: number): void {
    sendMessage(socket, ClientPayload.PlayShow, (builder) =>
      PlayShow.createPlayShow(builder, show),
    );
  }

  static sendAudioChunk(socket: WebSocket, pcmS16le: Uint8Array): void {
    sendMessage(socket, ClientPayload.AudioChunk, (builder) => {
      const pcm = AudioChunk.createPcmS16leVector(builder, pcmS16le);
      return AudioChunk.createAudioChunk(builder, pcm);
    });
  }

  static async resetAudio(socket: WebSocket): Promise<void> {
    await sendRequest(
      socket,
      ClientPayload.ResetAudio,
      (builder) => ResetAudio.createResetAudio(builder),
      ServerPayload.Success,
    );
  }

  static async getVolume(socket: WebSocket): Promise<number> {
    return (await sendRequest(
      socket,
      ClientPayload.GetVolume,
      (builder) => GetVolume.createGetVolume(builder),
      ServerPayload.Volume,
    ))!;
  }

  static async adjustVolume(socket: WebSocket, delta: number): Promise<number> {
    return (await sendRequest(
      socket,
      ClientPayload.AdjustVolume,
      (builder) => AdjustVolume.createAdjustVolume(builder, delta),
      ServerPayload.Volume,
    ))!;
  }
}
