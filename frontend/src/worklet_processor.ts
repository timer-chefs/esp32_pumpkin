declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(inputs: Float32Array<ArrayBuffer>[][]): boolean;
}

declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;

const TARGET_SAMPLE_RATE = 16_000;

class PcmProcessor extends AudioWorkletProcessor {
  private readonly sourceRate = sampleRate;
  private sourcePosition = 0;

  process(inputs: Float32Array<ArrayBuffer>[][]): boolean {
    const samples = inputs[0]?.[0];
    if (!samples?.length) {
      return true;
    }

    if (this.sourceRate === TARGET_SAMPLE_RATE) {
      this.postSamples(samples);
      return true;
    }

    const ratio = this.sourceRate / TARGET_SAMPLE_RATE;
    const maximumOutputLength = Math.max(1, Math.ceil(samples.length / ratio));
    const output = new Int16Array(maximumOutputLength);
    let outputIndex = 0;
    let position = this.sourcePosition;

    while (position < samples.length - 1 && outputIndex < output.length) {
      const sourceIndex = Math.floor(position);
      const fraction = position - sourceIndex;
      const interpolated =
        samples[sourceIndex] * (1 - fraction) +
        samples[sourceIndex + 1] * fraction;
      output[outputIndex++] = floatToInt16(interpolated);
      position += ratio;
    }

    this.sourcePosition = position - samples.length;
    if (outputIndex > 0) {
      this.postPcm(output.slice(0, outputIndex));
    }

    return true;
  }

  private postSamples(samples: Float32Array<ArrayBuffer>): void {
    const pcm = new Int16Array(samples.length);
    for (let index = 0; index < samples.length; index++) {
      pcm[index] = floatToInt16(samples[index]);
    }
    this.postPcm(pcm);
  }

  private postPcm(pcm: Int16Array<ArrayBuffer>): void {
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
  }
}

function floatToInt16(sample: number): number {
  const clampedSample = Math.max(-1, Math.min(1, sample));
  return clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff;
}

registerProcessor("pcm-processor", PcmProcessor);
