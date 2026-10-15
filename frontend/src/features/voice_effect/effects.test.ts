import { describe, expect, it } from "vitest";

import { effects, peakOf, repitch, stretch } from "./effects.ts";

const RATE = 16_000;
const shaping = effects.filter((effect) => effect.id !== "plain");

function tone(hz: number, seconds: number, level = 0.5) {
  return Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, index) => level * Math.sin((2 * Math.PI * hz * index) / RATE),
  );
}

function effectCalled(id: string) {
  return effects.find((effect) => effect.id === id)!;
}

/** Through an effect as the microphone feeds it: a block at a time. */
function live(id: string, samples: Float32Array<ArrayBuffer>, block = 128) {
  const stage = effectCalled(id).live(RATE)!;
  const result = new Float32Array(samples.length);
  for (let start = 0; start < samples.length; start += block) {
    result.set(stage(samples.slice(start, start + block)), start);
  }
  return result;
}

/** By how often it rises through zero, over its middle half. */
function frequencyOf(samples: Float32Array) {
  const start = Math.floor(samples.length / 4);
  const end = Math.floor((samples.length * 3) / 4);
  let crossings = 0;
  for (let index = start + 1; index < end; index++) {
    if (samples[index - 1] < 0 && samples[index] >= 0) {
      crossings++;
    }
  }
  return crossings / ((end - start) / RATE);
}

describe("repitch", () => {
  it.each([0.68, 1.3])(
    "moves the pitch by %f without changing the length",
    (factor) => {
      const result = repitch(tone(200, 1), RATE, factor);

      expect(Math.abs(result.length - RATE)).toBeLessThanOrEqual(2);
      expect(frequencyOf(result) / 200).toBeCloseTo(factor, 1);
    },
  );
});

describe("stretch", () => {
  it("changes the length without moving the pitch", () => {
    const result = stretch(tone(200, 1), RATE, 1.5);

    expect(result.length).toBe(1.5 * RATE);
    expect(frequencyOf(result)).toBeCloseTo(200, -1);
  });
});

describe("effects on a whole of speech", () => {
  it.each(effects.map((effect) => [effect.name, effect] as const))(
    "%s keeps the voice as loud as it was",
    (_, effect) => {
      const result = effect.apply(tone(150, 1, 0.6), RATE);

      expect(result.every(Number.isFinite)).toBe(true);
      expect(peakOf(result)).toBeCloseTo(0.6, 5);
    },
  );

  it("leaves room for the echoes to die away", () => {
    const result = effectCalled("ghost").apply(tone(200, 0.5), RATE);

    expect(result.length).toBeGreaterThanOrEqual(3 * RATE - 2);
    expect(peakOf(result.slice(0.6 * RATE, 0.8 * RATE))).toBeGreaterThan(0.01);
  });

  it("leaves the voice alone when it's plain", () => {
    const samples = tone(150, 0.1);
    const plain = effectCalled("plain");

    expect(plain.apply(samples, RATE)).toBe(samples);
    expect(plain.lengthScale).toBe(1);
  });
});

describe("effects on a live voice", () => {
  it.each([
    ["demon", 0.68],
    ["witch", 1.3],
  ] as const)("%s moves the pitch as it goes", (id, factor) => {
    const result = live(id, tone(200, 2));

    expect(result.length).toBe(2 * RATE);
    expect(frequencyOf(result) / 200).toBeCloseTo(factor, 1);
  });

  it.each(shaping.map((effect) => effect.id))(
    "%s sounds the same however the voice is split up",
    (id) => {
      const samples = tone(180, 0.5);

      expect(live(id, samples, 128)).toEqual(live(id, samples, 1000));
    },
  );

  it.each(shaping.map((effect) => effect.id))(
    "%s keeps a live voice within bounds",
    (id) => {
      const result = live(id, tone(150, 1, 0.5));

      expect(result.every(Number.isFinite)).toBe(true);
      expect(peakOf(result)).toBeLessThan(1);
      expect(peakOf(result)).toBeGreaterThan(0.1);
    },
  );

  it("leaves a plain voice alone", () => {
    expect(effectCalled("plain").live(RATE)).toBeNull();
  });
});
