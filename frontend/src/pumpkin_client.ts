import {
  AdjustVolume,
  AudioChunk,
  AudioUploadChunk,
  BeginAudioUpload,
  CancelAudioUpload,
  ClientPayload,
  FinishAudioUpload,
  GetVolume,
  ListAudioFiles,
  PlayAudioFile,
  PlayShow,
  ResetAudio,
  ServerPayload,
  StartAudioStream,
  StopAudioStream,
} from "./generated/pumpkin/protocol.ts";
import type { AudioFileInfo, PumpkinConnection } from "./pumpkin_connection.ts";

export type { AudioFileInfo };

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

  /** Lists the audio files the device has on its SD card. */
  static listAudioFiles(
    connection: PumpkinConnection,
  ): Promise<AudioFileInfo[]> {
    return connection.sendRequest(
      ClientPayload.ListAudioFiles,
      (builder) => ListAudioFiles.createListAudioFiles(builder),
      ServerPayload.AudioFileList,
    );
  }

  /** Plays a file straight off the SD card, with no streaming involved. */
  static playAudioFile(
    connection: PumpkinConnection,
    name: string,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.PlayAudioFile,
      (builder) =>
        PlayAudioFile.createPlayAudioFile(builder, builder.createString(name)),
      ServerPayload.Success,
    );
  }

  /** Announces a file the device should expect to receive, and its size in bytes. */
  static beginAudioUpload(
    connection: PumpkinConnection,
    name: string,
    size: number,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.BeginAudioUpload,
      (builder) =>
        BeginAudioUpload.createBeginAudioUpload(
          builder,
          builder.createString(name),
          size,
        ),
      ServerPayload.Success,
    );
  }

  /**
   * Sends one chunk of the announced file. The response only arrives once the
   * device has written it to the card, which is what paces the upload.
   */
  static sendAudioUploadChunk(
    connection: PumpkinConnection,
    bytes: Uint8Array,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.AudioUploadChunk,
      (builder) => {
        const payload = AudioUploadChunk.createBytesVector(builder, bytes);
        return AudioUploadChunk.createAudioUploadChunk(builder, payload);
      },
      ServerPayload.Success,
    );
  }

  static finishAudioUpload(connection: PumpkinConnection): Promise<void> {
    return connection.sendRequest(
      ClientPayload.FinishAudioUpload,
      (builder) => FinishAudioUpload.createFinishAudioUpload(builder),
      ServerPayload.Success,
    );
  }

  static cancelAudioUpload(connection: PumpkinConnection): Promise<void> {
    return connection.sendRequest(
      ClientPayload.CancelAudioUpload,
      (builder) => CancelAudioUpload.createCancelAudioUpload(builder),
      ServerPayload.Success,
    );
  }
}
