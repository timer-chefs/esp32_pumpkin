import { describe, expect, it } from "vitest";

import { effects, peakOf, repitch, reverb, stretch } from "./effects.ts";

const RATE = 16_000;

function tone(hz: number, seconds: number, level = 0.5) {
  return Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, index) => level * Math.sin((2 * Math.PI * hz * index) / RATE),
  );
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

describe("reverb", () => {
  it("leaves room for the echoes to die away", () => {
    const result = reverb(tone(200, 0.5), RATE, { decay: 1, wet: 0.5 });

    expect(result.length).toBe(1.5 * RATE);
    expect(peakOf(result.slice(0.6 * RATE, 0.8 * RATE))).toBeGreaterThan(0.01);
  });
});

describe("effects", () => {
  it.each(effects.map((effect) => [effect.name, effect] as const))(
    "%s keeps the voice as loud as it was",
    (_, effect) => {
      const result = effect.apply(tone(150, 1, 0.6), RATE);

      expect(result.every(Number.isFinite)).toBe(true);
      expect(peakOf(result)).toBeCloseTo(0.6, 5);
    },
  );

  it("leaves the voice alone when it's plain", () => {
    const samples = tone(150, 0.1);
    const plain = effects.find((effect) => effect.id === "plain")!;

    expect(plain.apply(samples, RATE)).toBe(samples);
    expect(plain.lengthScale).toBe(1);
  });
});
