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
} from "./generated/pumpkin/protocol.ts";
import type { PumpkinConnection } from "./pumpkin_connection.ts";

export default class PumpkinClient {
  static startAudioStream(connection: PumpkinConnection): void {
    connection.sendMessage(ClientPayload.StartAudioStream, (builder) =>
      StartAudioStream.createStartAudioStream(builder),
    );
  }

  static stopAudioStream(connection: PumpkinConnection): void {
    connection.sendMessage(ClientPayload.StopAudioStream, (builder) =>
      StopAudioStream.createStopAudioStream(builder),
    );
  }

  static playShow(connection: PumpkinConnection, show: number): void {
    connection.sendMessage(ClientPayload.PlayShow, (builder) =>
      PlayShow.createPlayShow(builder, show),
    );
  }

  static sendAudioChunk(
    connection: PumpkinConnection,
    pcmS16le: Uint8Array,
  ): void {
    connection.sendMessage(ClientPayload.AudioChunk, (builder) => {
      const pcm = AudioChunk.createPcmS16leVector(builder, pcmS16le);
      return AudioChunk.createAudioChunk(builder, pcm);
    });
  }

  static resetAudio(connection: PumpkinConnection): Promise<void> {
    return connection.sendRequest(
      ClientPayload.ResetAudio,
      (builder) => ResetAudio.createResetAudio(builder),
      ServerPayload.Success,
    );
  }

  static getVolume(connection: PumpkinConnection): Promise<number> {
    return connection.sendRequest(
      ClientPayload.GetVolume,
      (builder) => GetVolume.createGetVolume(builder),
      ServerPayload.Volume,
    );
  }

  static adjustVolume(
    connection: PumpkinConnection,
    delta: number,
  ): Promise<number> {
    return connection.sendRequest(
      ClientPayload.AdjustVolume,
      (builder) => AdjustVolume.createAdjustVolume(builder, delta),
      ServerPayload.Volume,
    );
  }
}
