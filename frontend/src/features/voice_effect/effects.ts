type Samples = Float32Array<ArrayBuffer>;

/**
 * Works through a stream a block at a time, keeping what it needs from one
 * block for the next, so it can shape a live voice as well as a whole one.
 */
export type Stage = (block: Samples) => Samples;

export interface Effect {
  id: string;
  name: string;
  /**
   * How much longer than usual a typed voice should draw each sound out.
   * The speech slows by less than this: at 1.5 it takes about 1.2 times as
   * long. A live voice can't be slowed down.
   */
  lengthScale: number;
  /** Shapes a whole of what a voice said: mono samples, at the given rate. */
  apply: (samples: Samples, sampleRate: number) => Samples;
  /** Shapes a live voice as it comes, or null if it's left as it is. */
  live: (sampleRate: number) => Stage | null;
}

interface Recipe {
  /** Above 1 is higher, below 1 lower. */
  pitch: number;
  /** See Effect. */
  lengthScale: number;
  /** How hard to overdrive it, for a growl. */
  growl?: number;
  /** How often the pitch wavers, and by about how much either way. */
  waver?: { hz: number; wobble: number };
  /** How often the loudness throbs, and by how much. */
  throb?: { hz: number; depth: number };
  /**
   * The echoes of a room: how many seconds they take to die away, and how
   * much of them to mix in.
   */
  echo?: { decay: number; wet: number };
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
    growl: 2.5,
    echo: { decay: 0.8, wet: 0.2 },
  }),
  effect("ghost", "Ghost", {
    pitch: 1.08,
    lengthScale: 1.65,
    waver: { hz: 4, wobble: 0.02 },
    throb: { hz: 5, depth: 0.35 },
    echo: { decay: 2.5, wet: 0.55 },
  }),
  effect("witch", "Witch", {
    pitch: 1.3,
    lengthScale: 1.1,
    // A quaver in the voice, like an old crone's.
    waver: { hz: 7, wobble: 0.045 },
    echo: { decay: 0.4, wet: 0.15 },
  }),
  {
    id: "plain",
    name: "Plain",
    lengthScale: 1,
    apply: (samples) => samples,
    live: () => null,
  },
];

function effect(id: string, name: string, recipe: Recipe): Effect {
  const { pitch, lengthScale, echo } = recipe;

  return {
    id,
    name,
    lengthScale,
    apply: (samples, sampleRate) => {
      const repitched = repitch(samples, sampleRate, pitch);
      // With room at the end for the echoes to die away.
      const input = new Float32Array(
        repitched.length + Math.ceil((echo?.decay ?? 0) * sampleRate),
      );
      input.set(repitched);

      const shaped = chain(shaping(sampleRate, recipe))(input);
      return matchPeak(shaped, peakOf(samples));
    },
    live: (sampleRate) =>
      chain([
        ...(pitch > 1 ? antiAlias(sampleRate, pitch) : []),
        ...(pitch === 1 ? [] : [pitchShifter(sampleRate, pitch)]),
        ...shaping(sampleRate, recipe),
      ]),
  };
}

/** What's done to the voice once it's at its new pitch. */
function shaping(
  sampleRate: number,
  { growl, waver, throb, echo }: Recipe,
): Stage[] {
  return [
    growl === undefined ? null : overdrive(sampleRate, growl),
    waver === undefined ? null : vibrato(sampleRate, waver.hz, waver.wobble),
    throb === undefined ? null : tremolo(sampleRate, throb.hz, throb.depth),
    echo === undefined ? null : reverb(sampleRate, echo.decay, echo.wet),
  ].filter((stage) => stage !== null);
}

function chain(stages: Stage[]): Stage {
  return (block) => stages.reduce((samples, stage) => stage(samples), block);
}

/**
 * Moves the pitch of a whole of speech by a factor without changing how long
 * it takes to say.
 */
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
  const source =
    factor > 1 ? chain(antiAlias(sampleRate, factor))(samples) : samples;
  const result = new Float32Array(Math.floor((source.length - 1) / factor) + 1);

  for (let index = 0; index < result.length; index++) {
    const position = index * factor;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, source.length - 1);
    const weight = position - lower;
    result[index] = source[lower] * (1 - weight) + source[upper] * weight;
  }

  return result;
}

/**
 * Moves the pitch of a live voice as it comes, by reading back through the
 * last moment of it at a different speed: two readers a grain apart, each
 * faded out as it jumps back. It lags by about half a grain.
 */
function pitchShifter(sampleRate: number, factor: number): Stage {
  const grain = Math.round(0.06 * sampleRate);
  const heard = delayLine(grain + 2);
  // How far through the grain the first reader has fallen behind.
  let phase = 0;

  return (block) =>
    block.map((sample) => {
      heard.push(sample);

      let result = 0;
      for (const offset of [0, 0.5]) {
        const behind = (phase + offset) % 1;
        // The two fades add up to one at every point.
        result += heard.read(behind * grain) * Math.sin(Math.PI * behind) ** 2;
      }

      phase = (((phase + (1 - factor) / grain) % 1) + 1) % 1;
      return result;
    });
}

/**
 * Speeding it up would fold what's above the new top back down as a hiss,
 * so that's taken out first.
 */
function antiAlias(sampleRate: number, factor: number): Stage[] {
  const cutoff = (0.45 * sampleRate) / factor;
  return [lowPass(sampleRate, cutoff), lowPass(sampleRate, cutoff)];
}

/** Overdrives it for a growl, as hard however loud it is. */
function overdrive(sampleRate: number, drive: number): Stage {
  // How loud it's been lately, so a quiet voice growls as much as a loud one.
  const fade = Math.exp(-1 / (0.3 * sampleRate));
  let level = 0;

  return (block) =>
    block.map((sample) => {
      level = Math.max(Math.abs(sample), level * fade);
      const scale = Math.max(level, 1e-3);
      return (Math.tanh((drive * sample) / scale) / Math.tanh(drive)) * scale;
    });
}

/** Makes the pitch waver by about `wobble` either way, `hz` times a second. */
function vibrato(sampleRate: number, hz: number, wobble: number): Stage {
  // A delay that swings by this much bends the pitch by `wobble` at most.
  const depth = (wobble / (Math.PI * hz)) * sampleRate;
  const heard = delayLine(Math.ceil(depth) + 2);
  let phase = 0;

  return (block) =>
    block.map((sample) => {
      heard.push(sample);
      const swing = (1 + Math.sin(2 * Math.PI * phase)) / 2;
      phase = (phase + hz / sampleRate) % 1;
      return heard.read(depth * swing);
    });
}

/** Makes the loudness throb by `depth`, `hz` times a second. */
function tremolo(sampleRate: number, hz: number, depth: number): Stage {
  let phase = 0;

  return (block) =>
    block.map((sample) => {
      const swing = (1 + Math.sin(2 * Math.PI * phase)) / 2;
      phase = (phase + hz / sampleRate) % 1;
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
 * in `wet` of them.
 */
function reverb(sampleRate: number, decay: number, wet: number): Stage {
  const combs = COMB_DELAYS.map((seconds) => ({
    echoes: new Float32Array(Math.round(seconds * sampleRate)),
    // Quiet by 60 dB once `decay` has passed.
    feedback: Math.pow(10, (-3 * seconds) / decay),
    damped: 0,
  }));
  const allpasses = ALLPASS_DELAYS.map((seconds) => ({
    inputs: new Float32Array(Math.round(seconds * sampleRate)),
    outputs: new Float32Array(Math.round(seconds * sampleRate)),
  }));
  let count = 0;

  return (block) =>
    block.map((sample) => {
      let echoes = 0;
      for (const comb of combs) {
        const slot = count % comb.echoes.length;
        // Each echo comes back duller than it went out, as off a real wall.
        comb.damped = 0.7 * comb.echoes[slot] + 0.3 * comb.damped;
        comb.echoes[slot] = sample + comb.feedback * comb.damped;
        echoes += comb.echoes[slot] / combs.length;
      }

      for (const allpass of allpasses) {
        const slot = count % allpass.inputs.length;
        const diffused =
          -0.5 * echoes + allpass.inputs[slot] + 0.5 * allpass.outputs[slot];
        allpass.inputs[slot] = echoes;
        allpass.outputs[slot] = diffused;
        echoes = diffused;
      }

      count++;
      return sample * (1 - wet) + echoes * wet;
    });
}

function lowPass(sampleRate: number, cutoff: number): Stage {
  // A biquad, as in the Audio EQ Cookbook.
  const omega = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.SQRT1_2);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let [x1, x2, y1, y2] = [0, 0, 0, 0];

  return (block) =>
    block.map((x) => {
      const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      [x2, x1, y2, y1] = [x1, x, y1, y];
      return y;
    });
}

/** The last `length` samples heard, to read back from any way behind. */
function delayLine(length: number) {
  const samples = new Float32Array(length);
  let newest = 0;
  const at = (index: number) => samples[((index % length) + length) % length];

  return {
    push: (sample: number) => {
      newest = (newest + 1) % length;
      samples[newest] = sample;
    },
    /** From `behind` samples ago, between samples too: 0 is the newest. */
    read: (behind: number) => {
      const position = newest - behind;
      const lower = Math.floor(position);
      const weight = position - lower;
      return at(lower) * (1 - weight) + at(lower + 1) * weight;
    },
  };
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
