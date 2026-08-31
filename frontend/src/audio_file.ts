import { audioSessionManager } from "./audio_session.ts";

const TARGET_SAMPLE_RATE = 16_000;
const CHUNK_SIZE = 512;
const BYTES_PER_SECOND = TARGET_SAMPLE_RATE * Int16Array.BYTES_PER_ELEMENT;

export type AudioFileStatus = (
  message: string,
  tone?: "neutral" | "success",
) => void;

export async function streamAudioFile(
  file: File,
  setStatus: AudioFileStatus = () => {},
): Promise<void> {
  const pcm = await decodeAudioFile(file);
  const session = await audioSessionManager.start({
    onError: (error) => console.error("Audio session error:", error),
  });
  const data = new Uint8Array(pcm.buffer);
  const startedAt = performance.now();
  let bytesSent = 0;
  let updateCount = 0;

  setStatus("Streaming...");

  try {
    for (let offset = 0; offset < data.length;) {
      if (!audioSessionManager.isActive(session)) {
        return;
      }

      const chunk = data.slice(
        offset,
        Math.min(offset + CHUNK_SIZE, data.length),
      );
      if (!session.send(chunk)) {
        throw new Error("Audio session stopped before streaming completed");
      }

      offset += chunk.length;
      bytesSent += chunk.length;

      if (updateCount++ % 50 === 0) {
        const progress = Math.round((offset / data.length) * 100);
        const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
        setStatus(`Streaming: ${progress}% (${bytesSent} bytes, ${elapsed}s)`);
      }

      const elapsedMilliseconds = performance.now() - startedAt;
      const targetMilliseconds = (bytesSent / BYTES_PER_SECOND) * 1000;
      const delayMilliseconds = Math.max(
        0,
        Math.round(targetMilliseconds - elapsedMilliseconds),
      );

      if (!(await session.wait(delayMilliseconds))) {
        return;
      }
    }

    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(2);
    setStatus(`Complete! (${bytesSent} bytes in ${elapsed}s)`, "success");

    if (await session.wait(500)) {
      await audioSessionManager.stop(session);
    }
  } catch (error) {
    await audioSessionManager.stop(session, { notifyServer: false });
    throw error;
  }
}

async function decodeAudioFile(file: File): Promise<Int16Array<ArrayBuffer>> {
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(
      await file.arrayBuffer(),
    );
    const monoData = mixToMono(audioBuffer);
    const resampledData = resampleAudio(
      monoData,
      audioBuffer.sampleRate,
      TARGET_SAMPLE_RATE,
    );
    const { data, peak } = convertToInt16(resampledData);

    if (peak < 0.1) {
      console.warn("Audio level is very quiet (peak below 10%).");
    }

    return data;
  } finally {
    await audioContext.close();
  }
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array<ArrayBuffer> {
  if (audioBuffer.numberOfChannels !== 2) {
    return audioBuffer.getChannelData(0);
  }

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);

  for (let index = 0; index < mono.length; index++) {
    mono[index] = (left[index] + right[index]) * 0.5;
  }

  return mono;
}

function resampleAudio(
  data: Float32Array<ArrayBuffer>,
  fromSampleRate: number,
  toSampleRate: number,
): Float32Array<ArrayBuffer> {
  if (fromSampleRate === toSampleRate) {
    return data;
  }

  const ratio = toSampleRate / fromSampleRate;
  const result = new Float32Array(Math.round(data.length * ratio));

  for (let outputIndex = 0; outputIndex < result.length; outputIndex++) {
    const sourceIndex = outputIndex / ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const upperIndex = Math.min(Math.ceil(sourceIndex), data.length - 1);
    const weight = sourceIndex - lowerIndex;
    result[outputIndex] =
      data[lowerIndex] * (1 - weight) + data[upperIndex] * weight;
  }

  return result;
}

function convertToInt16(data: Float32Array<ArrayBuffer>): {
  data: Int16Array<ArrayBuffer>;
  peak: number;
} {
  const result = new Int16Array(data.length);
  let peak = 0;

  for (let index = 0; index < data.length; index++) {
    const dither = (Math.random() - 0.5) * 0.0001;
    const sample = Math.max(-1, Math.min(1, data[index] + dither));
    result[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    peak = Math.max(peak, Math.abs(sample));
  }

  return { data: result, peak };
}
