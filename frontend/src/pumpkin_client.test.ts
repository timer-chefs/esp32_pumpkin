import * as flatbuffers from "flatbuffers";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ClientPayload,
  EyeEffectId,
  EyeServoId,
  LightEffectId,
  PlayPreset,
  PreviewServoAngle,
  SaveServoCalibration,
  SetLight,
} from "./generated/pumpkin/protocol.ts";
import api, { type PresetScene } from "./pumpkin_client.ts";
import type { PumpkinConnection } from "./pumpkin_connection.ts";

type CreatePayload = (builder: flatbuffers.Builder) => flatbuffers.Offset;

/** Plays `scene` and reads back the PlayPreset it was encoded as. */
async function encodePreset(scene: PresetScene): Promise<PlayPreset> {
  const sendRequest = vi.fn().mockResolvedValue(undefined);
  await api.playPreset({ sendRequest } as unknown as PumpkinConnection, scene);

  const [payloadType, createPayload] = sendRequest.mock.calls[0] as [
    ClientPayload,
    CreatePayload,
  ];
  expect(payloadType).toBe(ClientPayload.PlayPreset);

  const builder = new flatbuffers.Builder();
  builder.finish(createPayload(builder));
  return PlayPreset.getRootAsPlayPreset(
    new flatbuffers.ByteBuffer(builder.asUint8Array()),
  );
}

describe("PumpkinClient.playPreset", () => {
  it("encodes the whole scene", async () => {
    const preset = await encodePreset({
      light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#8000fF" },
      sound: "ghost.wav",
      eye: EyeEffectId.WANDER,
    });

    const light = preset.light();
    expect(light?.effect()).toBe(LightEffectId.AUDIO_REACTIVE);
    expect(light?.color()?.r()).toBe(0x80);
    expect(light?.color()?.g()).toBe(0x00);
    expect(light?.color()?.b()).toBe(0xff);
    expect(preset.sound()).toBe("ghost.wav");
    expect(preset.eye()).toBe(EyeEffectId.WANDER);
  });

  it("leaves out the parts a scene doesn't have", async () => {
    const preset = await encodePreset({
      light: null,
      sound: null,
      eye: EyeEffectId.NONE,
    });

    expect(preset.light()).toBeNull();
    expect(preset.sound()).toBeNull();
    expect(preset.eye()).toBe(EyeEffectId.NONE);
  });

  it("refuses a color it can't read", async () => {
    const sendRequest = vi.fn().mockResolvedValue(undefined);
    await api.playPreset({ sendRequest } as unknown as PumpkinConnection, {
      light: { effect: LightEffectId.CANDLE, color: "orange" },
      sound: null,
      eye: EyeEffectId.NONE,
    });
    const createPayload = sendRequest.mock.calls[0][1] as CreatePayload;

    expect(() => createPayload(new flatbuffers.Builder())).toThrow(
      'Expected a color like #ff8800, got "orange"',
    );
  });
});

describe("PumpkinClient.setLight", () => {
  it("encodes the light", () => {
    const sendMessage = vi.fn();
    api.setLight({ sendMessage } as unknown as PumpkinConnection, {
      effect: LightEffectId.AUDIO_REACTIVE,
      color: "#ffa500",
    });

    const [payloadType, createPayload] = sendMessage.mock.calls[0] as [
      ClientPayload,
      CreatePayload,
    ];
    expect(payloadType).toBe(ClientPayload.SetLight);

    const builder = new flatbuffers.Builder();
    builder.finish(createPayload(builder));
    const light = SetLight.getRootAsSetLight(
      new flatbuffers.ByteBuffer(builder.asUint8Array()),
    ).light();
    expect(light?.effect()).toBe(LightEffectId.AUDIO_REACTIVE);
    expect(light?.color()?.r()).toBe(0xff);
    expect(light?.color()?.g()).toBe(0xa5);
    expect(light?.color()?.b()).toBe(0x00);
  });
});

describe("PumpkinClient servo calibration", () => {
  it("sends a raw angle to the servo it names", () => {
    const sendMessage = vi.fn();
    api.previewServoAngle(
      { sendMessage } as unknown as PumpkinConnection,
      "lid",
      42,
    );

    const [payloadType, createPayload] = sendMessage.mock.calls[0] as [
      ClientPayload,
      CreatePayload,
    ];
    expect(payloadType).toBe(ClientPayload.PreviewServoAngle);

    const builder = new flatbuffers.Builder();
    builder.finish(createPayload(builder));
    const preview = PreviewServoAngle.getRootAsPreviewServoAngle(
      new flatbuffers.ByteBuffer(builder.asUint8Array()),
    );
    expect(preview.servo()).toBe(EyeServoId.LID);
    expect(preview.angle()).toBe(42);
  });

  it("encodes the range to store", async () => {
    const sendRequest = vi.fn().mockResolvedValue(undefined);
    await api.saveServoCalibration(
      { sendRequest } as unknown as PumpkinConnection,
      "ball",
      { min: 170, max: 15 },
    );

    const [payloadType, createPayload] = sendRequest.mock.calls[0] as [
      ClientPayload,
      CreatePayload,
    ];
    expect(payloadType).toBe(ClientPayload.SaveServoCalibration);

    const builder = new flatbuffers.Builder();
    builder.finish(createPayload(builder));
    const save = SaveServoCalibration.getRootAsSaveServoCalibration(
      new flatbuffers.ByteBuffer(builder.asUint8Array()),
    );
    expect(save.servo()).toBe(EyeServoId.BALL);
    expect(save.range()?.minAngle()).toBe(170);
    expect(save.range()?.maxAngle()).toBe(15);
  });
});

describe("PumpkinClient presets file", () => {
  function answer(status: number, body = "") {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(body || null, { status }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the file the device has, fresh every time", async () => {
    const fetch = answer(200, "name\nGhost\n");

    await expect(api.getPresetsFile()).resolves.toBe("name\nGhost\n");
    expect(fetch).toHaveBeenCalledWith("/api/presets", { cache: "no-store" });
  });

  it("reads a card that has no file as having none", async () => {
    answer(404, "No presets are stored on the SD card");

    await expect(api.getPresetsFile()).resolves.toBeNull();
  });

  it("passes on the device's explanation of what went wrong", async () => {
    answer(503, "No SD card detected");

    await expect(api.getPresetsFile()).rejects.toThrow("No SD card detected");
  });

  it("puts the whole file in place of the stored one", async () => {
    const fetch = answer(204);

    await api.savePresetsFile("name\nGhost\n");

    expect(fetch).toHaveBeenCalledWith("/api/presets", {
      method: "PUT",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: "name\nGhost\n",
    });
  });

  it("says what the device answered when it gives no reason", async () => {
    answer(500);

    await expect(api.savePresetsFile("name\n")).rejects.toThrow(
      "The device answered 500",
    );
  });
});
