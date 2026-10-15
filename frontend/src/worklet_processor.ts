import { effects, type Stage } from "./features/voice_effect/effects.ts";

declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array<ArrayBuffer>[][]): boolean;
}

declare function registerProcessor(
  name: string,
  processor: new (options: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

const TARGET_SAMPLE_RATE = 16_000;

class PcmProcessor extends AudioWorkletProcessor {
  private readonly sourceRate = sampleRate;
  private sourcePosition = 0;
  private readonly effect: Stage | null;

  constructor({ processorOptions }: AudioWorkletNodeOptions) {
    super();
    // The voice effect to talk with, if any.
    const effectId: string | undefined = processorOptions?.effect;
    this.effect =
      effects
        .find((effect) => effect.id === effectId)
        ?.live(TARGET_SAMPLE_RATE) ?? null;
  }

  process(inputs: Float32Array<ArrayBuffer>[][]): boolean {
    const samples = inputs[0]?.[0];
    if (!samples?.length) {
      return true;
    }

    const resampled =
      this.sourceRate === TARGET_SAMPLE_RATE ? samples : this.resample(samples);
    if (resampled.length > 0) {
      this.postPcm(this.effect ? this.effect(resampled) : resampled);
    }

    return true;
  }

  private resample(
    samples: Float32Array<ArrayBuffer>,
  ): Float32Array<ArrayBuffer> {
    const ratio = this.sourceRate / TARGET_SAMPLE_RATE;
    const maximumOutputLength = Math.max(1, Math.ceil(samples.length / ratio));
    const output = new Float32Array(maximumOutputLength);
    let outputIndex = 0;
    let position = this.sourcePosition;

    while (position < samples.length - 1 && outputIndex < output.length) {
      const sourceIndex = Math.floor(position);
      const fraction = position - sourceIndex;
      output[outputIndex++] =
        samples[sourceIndex] * (1 - fraction) +
        samples[sourceIndex + 1] * fraction;
      position += ratio;
    }

    this.sourcePosition = position - samples.length;
    return output.slice(0, outputIndex);
  }

  private postPcm(samples: Float32Array<ArrayBuffer>): void {
    const pcm = Int16Array.from(samples, floatToInt16);
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
  }
}

function floatToInt16(sample: number): number {
  const clampedSample = Math.max(-1, Math.min(1, sample));
  return clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff;
}

registerProcessor("pcm-processor", PcmProcessor);
