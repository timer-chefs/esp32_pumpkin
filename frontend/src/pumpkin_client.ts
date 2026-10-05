import {
  AdjustVolume,
  AudioChunk,
  AudioUploadChunk,
  BeginAudioUpload,
  CancelAudioUpload,
  ClientPayload,
  Color,
  type EyeEffectId,
  FinishAudioUpload,
  GetVolume,
  Light,
  type LightEffectId,
  ListAudioFiles,
  MoveEye,
  MoveEyeLid,
  PlayAudioFile,
  PlayPreset,
  PlayShow,
  ResetAudio,
  ServerPayload,
  StartAudioStream,
  StopAudioStream,
} from "./generated/pumpkin/protocol.ts";
import type { AudioFileInfo, PumpkinConnection } from "./pumpkin_connection.ts";

export type { AudioFileInfo };

/** What a preset asks of the device. See PlayPreset in the protocol. */
export interface PresetScene {
  /** Null leaves the lights as they are. */
  light: { effect: LightEffectId; color: string } | null;
  /** A file in the SD card's audio directory, or null to play nothing. */
  sound: string | null;
  eye: EyeEffectId;
}

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

  /**
   * Completes an upload. The device reads the whole file back off the card to
   * check it against `checksum` before accepting it, so this answers a good
   * deal slower than the other requests.
   */
  static finishAudioUpload(
    connection: PumpkinConnection,
    checksum: number,
    timeoutMs: number,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.FinishAudioUpload,
      (builder) => FinishAudioUpload.createFinishAudioUpload(builder, checksum),
      ServerPayload.Success,
      timeoutMs,
    );
  }

  static cancelAudioUpload(connection: PumpkinConnection): Promise<void> {
    return connection.sendRequest(
      ClientPayload.CancelAudioUpload,
      (builder) => CancelAudioUpload.createCancelAudioUpload(builder),
      ServerPayload.Success,
    );
  }

  /**
   * Sets the lights, sound and eye in one go. Fails, changing nothing but
   * the sound, if the sound isn't on the SD card.
   */
  static playPreset(
    connection: PumpkinConnection,
    scene: PresetScene,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.PlayPreset,
      (builder) => {
        const sound =
          scene.sound === null ? null : builder.createString(scene.sound);

        let light: number | null = null;
        if (scene.light) {
          const [r, g, b] = parseHexColor(scene.light.color);
          Light.startLight(builder);
          Light.addEffect(builder, scene.light.effect);
          Light.addColor(builder, Color.createColor(builder, r, g, b));
          light = Light.endLight(builder);
        }

        PlayPreset.startPlayPreset(builder);
        if (light !== null) {
          PlayPreset.addLight(builder, light);
        }
        if (sound !== null) {
          PlayPreset.addSound(builder, sound);
        }
        PlayPreset.addEye(builder, scene.eye);
        return PlayPreset.endPlayPreset(builder);
      },
      ServerPayload.Success,
    );
  }

  /** Turns the eye: negative is left, 0 straight ahead, positive right. */
  static moveEye(connection: PumpkinConnection, at: number): void {
    connection.sendMessage(ClientPayload.MoveEye, (builder) =>
      MoveEye.createMoveEye(builder, at),
    );
  }

  /** Opens or closes the eye lid: 0 is shut, 255 wide open. */
  static moveEyeLid(connection: PumpkinConnection, openness: number): void {
    connection.sendMessage(ClientPayload.MoveEyeLid, (builder) =>
      MoveEyeLid.createMoveEyeLid(builder, openness),
    );
  }
}

/** Splits a "#rrggbb" color, the format a color input produces, into bytes. */
function parseHexColor(color: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) {
    throw new Error(`Expected a color like #ff8800, got "${color}"`);
  }

  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ];
}
