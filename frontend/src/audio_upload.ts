import { decodeAudioFile, TARGET_SAMPLE_RATE } from "./audio_file.ts";
import api from "./pumpkin_client.ts";
import type { PumpkinConnection } from "./pumpkin_connection.ts";

const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const WAV_HEADER_BYTES = 44;

// Has to stay at or below the device's max_upload_chunk_size.
const CHUNK_SIZE = 2048;

// The device acknowledges a chunk only once it has written it to the card, so
// this is what bounds how much of the upload can be sitting in the browser's
// send queue, in flight, or waiting in the device's receive buffer: never more
// than this many chunks. Two is enough to overlap the network with the card's
// write while keeping the outstanding data down to a few kilobytes.
const MAX_CHUNKS_IN_FLIGHT = 2;

// Rate is measured over a trailing window rather than the whole transfer, so
// it reflects what the card is doing now instead of averaging away a stall.
const RATE_WINDOW_MS = 3000;

const MAX_NAME_LENGTH = 63;

export interface UploadProgress {
  bytesSent: number;
  totalBytes: number;
  /** Measured end-to-end, from the device's acknowledgements. Null until enough have arrived. */
  bytesPerSecond: number | null;
  secondsRemaining: number | null;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Converts a file to the device's own audio format and stores it on the SD
 * card. Resolves with the name it was stored under.
 */
export async function uploadAudioFile(
  connection: PumpkinConnection,
  file: File,
  { onProgress = () => {}, signal }: UploadOptions = {},
): Promise<string> {
  const wav = encodeWav(await decodeAudioFile(file));
  const name = toStoredName(file.name);
  throwIfAborted(signal);

  await api.beginAudioUpload(connection, name, wav.length);

  try {
    await sendChunks(connection, wav, onProgress, signal);
    await api.finishAudioUpload(connection);
  } catch (error) {
    // Let the device drop what it has rather than leaving a part file behind.
    await api.cancelAudioUpload(connection).catch(() => {});
    throw error;
  }

  return name;
}

async function sendChunks(
  connection: PumpkinConnection,
  wav: Uint8Array,
  onProgress: (progress: UploadProgress) => void,
  signal: AbortSignal | undefined,
): Promise<void> {
  const rate = new TransferRate();
  const inFlight: Promise<void>[] = [];
  let bytesSent = 0;

  const report = () =>
    onProgress({
      bytesSent,
      totalBytes: wav.length,
      bytesPerSecond: rate.bytesPerSecond,
      secondsRemaining: rate.secondsFor(wav.length - bytesSent),
    });

  report();

  try {
    for (let offset = 0; offset < wav.length; offset += CHUNK_SIZE) {
      throwIfAborted(signal);

      const chunk = wav.subarray(offset, offset + CHUNK_SIZE);
      inFlight.push(
        api.sendAudioUploadChunk(connection, chunk).then(() => {
          bytesSent += chunk.length;
          rate.record(chunk.length);
          report();
        }),
      );

      if (inFlight.length >= MAX_CHUNKS_IN_FLIGHT) {
        await inFlight.shift();
      }
    }

    await Promise.all(inFlight.splice(0));
  } catch (error) {
    // Nothing may still be on its way when the caller cancels the upload.
    await Promise.allSettled(inFlight);
    throw error;
  }
}

/** Tracks throughput over a trailing window of acknowledged chunks. */
class TransferRate {
  private readonly samples: { at: number; bytes: number }[] = [];

  record(bytes: number): void {
    const now = performance.now();
    this.samples.push({ at: now, bytes });

    while (
      this.samples.length > 1 &&
      now - this.samples[0].at > RATE_WINDOW_MS
    ) {
      this.samples.shift();
    }
  }

  get bytesPerSecond(): number | null {
    if (this.samples.length < 2) {
      return null;
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const elapsed = last.at - first.at;
    if (elapsed <= 0) {
      return null;
    }

    // The first sample's bytes arrived before the window opened, so only the
    // ones after it count towards what was transferred during `elapsed`.
    const bytes = this.samples
      .slice(1)
      .reduce((total, sample) => total + sample.bytes, 0);

    return (bytes / elapsed) * 1000;
  }

  secondsFor(bytes: number): number | null {
    const rate = this.bytesPerSecond;
    return rate === null || rate === 0 ? null : bytes / rate;
  }
}

/** Wraps mono 16 kHz PCM in the WAV header the device expects. */
function encodeWav(pcm: Int16Array<ArrayBuffer>): Uint8Array {
  const bytesPerFrame = (BITS_PER_SAMPLE / 8) * CHANNELS;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, "WAVE");

  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Uncompressed PCM
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);

  const bytes = new Uint8Array(buffer);
  bytes.set(
    new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength),
    WAV_HEADER_BYTES,
  );
  return bytes;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/**
 * Turns a file name into one the device accepts: a bare `.wav` name, short
 * enough to store, with nothing in it that could be read as a path.
 */
export function toStoredName(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]*$/, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim();

  if (base === "") {
    return "audio.wav";
  }

  return `${base.slice(0, MAX_NAME_LENGTH - ".wav".length)}.wav`;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Upload cancelled", "AbortError");
  }
}
