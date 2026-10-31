import type * as flatbuffers from "flatbuffers";

import {
  AdjustVolume,
  AudioChunk,
  AudioUploadChunk,
  BeginAudioUpload,
  CancelAudioUpload,
  ClientPayload,
  Color,
  type EyeEffectId,
  EyeServoId,
  FinishAudioUpload,
  GetAutoMode,
  GetEyeCalibration,
  GetVolume,
  Light,
  type LightEffectId,
  ListAudioFiles,
  MoveEye,
  MoveEyeLid,
  PlayAudioFile,
  PlayPreset,
  PlayShow,
  PreviewServoAngle,
  ResetAudio,
  SaveServoCalibration,
  ServerPayload,
  ServoRange,
  SetLight,
  StartAudioStream,
  StartAutoMode,
  StopAudioStream,
  StopAutoMode,
} from "./generated/pumpkin/protocol.ts";
import type {
  AudioFileInfo,
  AutoModeInfo,
  EyeCalibrationInfo,
  PumpkinConnection,
  ServoRangeInfo,
} from "./pumpkin_connection.ts";

export type { AudioFileInfo, AutoModeInfo, EyeCalibrationInfo, ServoRangeInfo };

/** One of the eye's servos, named as in EyeCalibrationInfo. */
export type EyeServo = keyof EyeCalibrationInfo;

const servoIds: Record<EyeServo, EyeServoId> = {
  ball: EyeServoId.BALL,
  lid: EyeServoId.LID,
};

/** How to light the pumpkin. See Light in the protocol. */
export interface LightScene {
  effect: LightEffectId;
  /** As "#rrggbb". */
  color: string;
}

/** What a preset asks of the device. See PlayPreset in the protocol. */
export interface PresetScene {
  /** Null leaves the lights as they are. */
  light: LightScene | null;
  /** A file in the SD card's audio directory, or null to play nothing. */
  sound: string | null;
  eye: EyeEffectId;
}

/** How long auto mode pauses after each preset, picked at random in between. */
export interface PauseRange {
  minS: number;
  maxS: number;
}

/** Where the device keeps the presets file. See getPresetsFile(). */
const presetsUrl = "/api/presets";

export default class PumpkinClient {
  /**
   * The presets file the device keeps on its SD card, or null when the card
   * has none yet. Over HTTP rather than the connection, because the file can
   * outgrow a web socket message.
   */
  static async getPresetsFile(): Promise<string | null> {
    const response = await fetch(presetsUrl, { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }

    await throwUnlessOk(response);
    return response.text();
  }

  /**
   * Replaces the presets file on the SD card. The file it replaces is kept
   * as a backup, unless the two are the same.
   */
  static async savePresetsFile(csv: string): Promise<void> {
    const response = await fetch(presetsUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: csv,
    });
    await throwUnlessOk(response);
  }

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

        const light = scene.light ? createLight(builder, scene.light) : null;

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

  /**
   * Has the device play the presets in its presets file at random, pausing
   * after each, until stopped or something else is played. It runs on the
   * device, so it carries on with the page closed, and after a restart.
   * Sent while running, it changes the pause without cutting off what is
   * playing.
   */
  static startAutoMode(
    connection: PumpkinConnection,
    pause: PauseRange,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.StartAutoMode,
      (builder) =>
        StartAutoMode.createStartAutoMode(builder, pause.minS, pause.maxS),
      ServerPayload.Success,
    );
  }

  /** Stops auto mode, and the preset it is playing. */
  static stopAutoMode(connection: PumpkinConnection): Promise<void> {
    return connection.sendRequest(
      ClientPayload.StopAutoMode,
      (builder) => StopAutoMode.createStopAutoMode(builder),
      ServerPayload.Success,
    );
  }

  /** Whether the device is running auto mode, and how long it pauses. */
  static getAutoMode(connection: PumpkinConnection): Promise<AutoModeInfo> {
    return connection.sendRequest(
      ClientPayload.GetAutoMode,
      (builder) => GetAutoMode.createGetAutoMode(builder),
      ServerPayload.AutoModeStatus,
    );
  }

  /**
   * Lights the pumpkin, changing nothing else, until something else does.
   * Throws, sending nothing, if the color isn't "#rrggbb".
   */
  static setLight(connection: PumpkinConnection, light: LightScene): void {
    connection.sendMessage(ClientPayload.SetLight, (builder) =>
      SetLight.createSetLight(builder, createLight(builder, light)),
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

  /**
   * Holds a servo at a raw angle, 0-180, ignoring its calibration, so the
   * ends of its range can be found by eye.
   */
  static previewServoAngle(
    connection: PumpkinConnection,
    servo: EyeServo,
    angle: number,
  ): void {
    connection.sendMessage(ClientPayload.PreviewServoAngle, (builder) =>
      PreviewServoAngle.createPreviewServoAngle(
        builder,
        servoIds[servo],
        angle,
      ),
    );
  }

  static getEyeCalibration(
    connection: PumpkinConnection,
  ): Promise<EyeCalibrationInfo> {
    return connection.sendRequest(
      ClientPayload.GetEyeCalibration,
      (builder) => GetEyeCalibration.createGetEyeCalibration(builder),
      ServerPayload.EyeCalibration,
    );
  }

  /**
   * Stores a servo's range on the device. Moving the eye and its lid maps
   * onto it from then on.
   */
  static saveServoCalibration(
    connection: PumpkinConnection,
    servo: EyeServo,
    range: ServoRangeInfo,
  ): Promise<void> {
    return connection.sendRequest(
      ClientPayload.SaveServoCalibration,
      (builder) => {
        SaveServoCalibration.startSaveServoCalibration(builder);
        SaveServoCalibration.addServo(builder, servoIds[servo]);
        SaveServoCalibration.addRange(
          builder,
          ServoRange.createServoRange(builder, range.min, range.max),
        );
        return SaveServoCalibration.endSaveServoCalibration(builder);
      },
      ServerPayload.Success,
    );
  }
}

/** Throws the device's own explanation of a request it turned down. */
async function throwUnlessOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const explanation = (await response.text()).trim();
  throw new Error(
    explanation ||
      `The device answered ${response.status} ${response.statusText}`,
  );
}

function createLight(
  builder: flatbuffers.Builder,
  light: LightScene,
): flatbuffers.Offset {
  const [r, g, b] = parseHexColor(light.color);
  Light.startLight(builder);
  Light.addEffect(builder, light.effect);
  Light.addColor(builder, Color.createColor(builder, r, g, b));
  return Light.endLight(builder);
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
