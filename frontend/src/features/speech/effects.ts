type Samples = Float32Array<ArrayBuffer>;

export interface Effect {
  id: string;
  name: string;
  /**
   * How much longer than usual the voice should draw each sound out. The
   * speech slows by less than this: at 1.5 it takes about 1.2 times as long.
   */
  lengthScale: number;
  /** Shapes what the voice said: mono samples, at the given rate. */
  apply: (samples: Samples, sampleRate: number) => Samples;
}

interface Recipe {
  /** Above 1 is higher, below 1 lower. */
  pitch?: number;
  /** See Effect. */
  lengthScale?: number;
  /** What's done to the speech once it's at its new pitch. */
  shape?: (samples: Samples, sampleRate: number) => Samples;
}

/**
 * The ways to say it, the first being the one picked to begin with. Each is
 * a recipe of the steps below, so there's plenty to play with.
 */
export const effects: Effect[] = [
  effect("demon", "Demon", {
    // Down half an octave, which deepens the whole throat along with it.
    pitch: 0.68,
    lengthScale: 1.3,
    shape: (samples, sampleRate) =>
      reverb(saturate(samples, 2.5), sampleRate, { decay: 0.8, wet: 0.2 }),
  }),
  effect("ghost", "Ghost", {
    pitch: 1.08,
    lengthScale: 1.65,
    shape: (samples, sampleRate) =>
      reverb(
        tremolo(vibrato(samples, sampleRate, 4, 0.02), sampleRate, 5, 0.35),
        sampleRate,
        { decay: 2.5, wet: 0.55 },
      ),
  }),
  effect("witch", "Witch", {
    pitch: 1.3,
    lengthScale: 1.1,
    // A quaver in the voice, like an old crone's.
    shape: (samples, sampleRate) =>
      reverb(vibrato(samples, sampleRate, 7, 0.045), sampleRate, {
        decay: 0.4,
        wet: 0.15,
      }),
  }),
  { id: "plain", name: "Plain", lengthScale: 1, apply: (samples) => samples },
];

function effect(
  id: string,
  name: string,
  { pitch = 1, lengthScale = 1, shape = (samples) => samples }: Recipe,
): Effect {
  return {
    id,
    name,
    lengthScale,
    apply: (samples, sampleRate) =>
      matchPeak(
        shape(repitch(samples, sampleRate, pitch), sampleRate),
        peakOf(samples),
      ),
  };
}

/** Moves the pitch by a factor without changing how long it takes to say. */
export function repitch(
  samples: Samples,
  sampleRate: number,
  factor: number,
): Samples {
  if (factor === 1) {
    return samples;
  }

  // Played back faster, it's higher and shorter (and the other way round),
  // so it's first drawn out by as much as that will take back.
  return speedUp(stretch(samples, sampleRate, factor), sampleRate, factor);
}

/**
 * Makes it `factor` times as long without moving its pitch, by laying
 * slices of it over each other at a different spacing than they were taken
 * at (WSOLA).
 */
export function stretch(
  samples: Samples,
  sampleRate: number,
  factor: number,
): Samples {
  const frame = Math.round(0.03 * sampleRate);
  const hop = Math.floor(frame / 2);
  const search = Math.round(0.008 * sampleRate);
  const length = Math.round(samples.length * factor);
  if (samples.length < frame) {
    return samples;
  }

  // Hann windows half a frame apart add up to exactly one.
  const window = Float32Array.from(
    { length: frame },
    (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / frame),
  );
  const result = new Float32Array(length + frame);
  let previous = 0;

  for (let at = 0; at < length; at += hop) {
    // Where an even spacing would take the slice from, moved to wherever
    // best carries on from the last one, so the two don't cancel out.
    const nominal = Math.min(Math.round(at / factor), samples.length - frame);
    const following = previous + hop;
    const overlap = Math.min(hop, samples.length - following);
    let start = nominal;
    let bestMatch = -Infinity;

    for (let offset = -search; at > 0 && offset <= search; offset++) {
      const candidate = nominal + offset;
      if (candidate < 0 || candidate + frame > samples.length) {
        continue;
      }

      let match = 0;
      for (let index = 0; index < overlap; index++) {
        match += samples[candidate + index] * samples[following + index];
      }
      if (match > bestMatch) {
        bestMatch = match;
        start = candidate;
      }
    }

    for (let index = 0; index < frame; index++) {
      result[at + index] += samples[start + index] * window[index];
    }
    previous = start;
  }

  return result.slice(0, length);
}

/** Plays it back `factor` times as fast, which moves its pitch by as much. */
function speedUp(
  samples: Samples,
  sampleRate: number,
  factor: number,
): Samples {
  // Squeezing it up would fold what's above the new top back down as a
  // hiss, so that's taken out first.
  const cutoff = (0.45 * sampleRate) / factor;
  const source =
    factor > 1
      ? lowPass(lowPass(samples, sampleRate, cutoff), sampleRate, cutoff)
      : samples;
  const result = new Float32Array(Math.floor((source.length - 1) / factor) + 1);

  for (let index = 0; index < result.length; index++) {
    result[index] = sampleAt(source, index * factor);
  }

  return result;
}

/** Overdrives it, for a growl. */
function saturate(samples: Samples, drive: number): Samples {
  const peak = peakOf(samples) || 1;
  return samples.map(
    (sample) => Math.tanh((drive * sample) / peak) / Math.tanh(drive),
  );
}

/** Makes the pitch waver by about `wobble` either way, `hz` times a second. */
function vibrato(
  samples: Samples,
  sampleRate: number,
  hz: number,
  wobble: number,
): Samples {
  // A delay that swings by this much bends the pitch by `wobble` at most.
  const depth = (wobble / (Math.PI * hz)) * sampleRate;
  const result = new Float32Array(samples.length);

  for (let index = 0; index < samples.length; index++) {
    const swing = (1 + Math.sin((2 * Math.PI * hz * index) / sampleRate)) / 2;
    const position = index - depth * swing;
    result[index] = position < 0 ? 0 : sampleAt(samples, position);
  }

  return result;
}

/** Makes the loudness throb by `depth`, `hz` times a second. */
function tremolo(
  samples: Samples,
  sampleRate: number,
  hz: number,
  depth: number,
): Samples {
  return samples.map((sample, index) => {
    const swing = (1 + Math.sin((2 * Math.PI * hz * index) / sampleRate)) / 2;
    return sample * (1 - depth * swing);
  });
}

// Freeverb's delays, in seconds rather than samples at 44.1 kHz.
const COMB_DELAYS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(
  (samples) => samples / 44_100,
);
const ALLPASS_DELAYS = [556, 441, 341, 225].map((samples) => samples / 44_100);

/**
 * Puts it in a room whose echoes take `decay` seconds to die away, mixing
 * in `wet` of them. The speech gets longer by as much, so its end isn't cut.
 */
export function reverb(
  samples: Samples,
  sampleRate: number,
  { decay, wet }: { decay: number; wet: number },
): Samples {
  const input = new Float32Array(
    samples.length + Math.ceil(decay * sampleRate),
  );
  input.set(samples);
  let echoes = new Float32Array(input.length);

  for (const seconds of COMB_DELAYS) {
    const delay = Math.round(seconds * sampleRate);
    // Quiet by 60 dB once `decay` has passed.
    const feedback = Math.pow(10, (-3 * seconds) / decay);
    const comb = new Float32Array(input.length);
    let damped = 0;

    for (let index = 0; index < input.length; index++) {
      // Each echo comes back duller than it went out, as off a real wall.
      damped = 0.7 * (index >= delay ? comb[index - delay] : 0) + 0.3 * damped;
      comb[index] = input[index] + feedback * damped;
      echoes[index] += comb[index] / COMB_DELAYS.length;
    }
  }

  for (const seconds of ALLPASS_DELAYS) {
    const delay = Math.round(seconds * sampleRate);
    const diffused = new Float32Array(input.length);

    for (let index = 0; index < input.length; index++) {
      const delayed = index >= delay ? diffused[index - delay] : 0;
      const before = index >= delay ? echoes[index - delay] : 0;
      diffused[index] = -0.5 * echoes[index] + before + 0.5 * delayed;
    }
    echoes = diffused;
  }

  return input.map((sample, index) => sample * (1 - wet) + echoes[index] * wet);
}

function lowPass(
  samples: Samples,
  sampleRate: number,
  cutoff: number,
): Samples {
  // A biquad, as in the Audio EQ Cookbook.
  const omega = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.SQRT1_2);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;

  const result = new Float32Array(samples.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let index = 0; index < samples.length; index++) {
    const x = samples[index];
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    result[index] = y;
  }

  return result;
}

function sampleAt(samples: Samples, position: number): number {
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, samples.length - 1);
  const weight = position - lower;
  return samples[lower] * (1 - weight) + samples[upper] * weight;
}

export function peakOf(samples: Samples): number {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}

/** Brings it back to as loud as the voice was, however the effect left it. */
function matchPeak(samples: Samples, peak: number): Samples {
  const current = peakOf(samples);
  return current === 0
    ? samples
    : samples.map((sample) => (sample * peak) / current);
}
