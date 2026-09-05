import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeAudioFile } from "./audio_file.ts";
import { toStoredName, uploadAudioFile } from "./audio_upload.ts";
import api from "./pumpkin_client.ts";
import type { PumpkinConnection } from "./pumpkin_connection.ts";

vi.mock("./audio_file.ts", () => ({
  TARGET_SAMPLE_RATE: 16_000,
  decodeAudioFile: vi.fn(),
}));

vi.mock("./pumpkin_client.ts", () => ({
  default: {
    beginAudioUpload: vi.fn(),
    sendAudioUploadChunk: vi.fn(),
    finishAudioUpload: vi.fn(),
    cancelAudioUpload: vi.fn(),
  },
}));

const CHUNK_SIZE = 2048;
const MAX_CHUNKS_IN_FLIGHT = 2;
const WAV_HEADER_BYTES = 44;

const connection = {} as PumpkinConnection;
const file = new File(["ignored, the decoder is mocked"], "Spooky Song.mp3");

// Enough samples to need several chunks, so pacing is actually observable.
const SAMPLE_COUNT = 4200;

function sentBytes(): Uint8Array {
  const chunks = vi
    .mocked(api.sendAudioUploadChunk)
    .mock.calls.map(([, bytes]) => bytes);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);

  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(decodeAudioFile).mockResolvedValue(new Int16Array(SAMPLE_COUNT));
  vi.mocked(api.beginAudioUpload).mockResolvedValue();
  vi.mocked(api.sendAudioUploadChunk).mockResolvedValue();
  vi.mocked(api.finishAudioUpload).mockResolvedValue();
  vi.mocked(api.cancelAudioUpload).mockResolvedValue();
});

describe("uploadAudioFile", () => {
  it("announces and sends the file as a WAV the device can play", async () => {
    const expectedBytes = WAV_HEADER_BYTES + SAMPLE_COUNT * 2;

    const name = await uploadAudioFile(connection, file);

    expect(name).toBe("Spooky Song.wav");
    expect(api.beginAudioUpload).toHaveBeenCalledWith(
      connection,
      "Spooky Song.wav",
      expectedBytes,
    );

    const bytes = sentBytes();
    const header = new DataView(bytes.buffer, bytes.byteOffset);
    expect(bytes.length).toBe(expectedBytes);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(header.getUint16(22, true)).toBe(1); // Mono
    expect(header.getUint32(24, true)).toBe(16_000);
    expect(header.getUint16(34, true)).toBe(16); // Bits per sample
    expect(header.getUint32(40, true)).toBe(SAMPLE_COUNT * 2);

    expect(api.finishAudioUpload).toHaveBeenCalledOnce();
    expect(api.cancelAudioUpload).not.toHaveBeenCalled();
  });

  it("waits for acknowledgements instead of buffering the whole file", async () => {
    let inFlight = 0;
    let mostInFlight = 0;

    vi.mocked(api.sendAudioUploadChunk).mockImplementation(async () => {
      inFlight++;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
    });

    await uploadAudioFile(connection, file);

    const chunkCount = vi.mocked(api.sendAudioUploadChunk).mock.calls.length;
    expect(chunkCount).toBeGreaterThan(MAX_CHUNKS_IN_FLIGHT);
    expect(mostInFlight).toBe(MAX_CHUNKS_IN_FLIGHT);
  });

  it("reports progress against the size it announced", async () => {
    const progress: number[] = [];

    await uploadAudioFile(connection, file, {
      onProgress: (update) => {
        expect(update.totalBytes).toBe(WAV_HEADER_BYTES + SAMPLE_COUNT * 2);
        progress.push(update.bytesSent);
      },
    });

    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(WAV_HEADER_BYTES + SAMPLE_COUNT * 2);
    expect(progress).toStrictEqual([...progress].sort((a, b) => a - b));
  });

  it("has the device drop the part file when a chunk fails", async () => {
    vi.mocked(api.sendAudioUploadChunk)
      .mockResolvedValueOnce()
      .mockRejectedValue(new Error("Could not write to the SD card"));

    await expect(uploadAudioFile(connection, file)).rejects.toThrow(
      "Could not write to the SD card",
    );

    expect(api.cancelAudioUpload).toHaveBeenCalledOnce();
    expect(api.finishAudioUpload).not.toHaveBeenCalled();
  });

  it("stops sending once the upload is cancelled", async () => {
    const controller = new AbortController();
    vi.mocked(api.sendAudioUploadChunk).mockImplementation(async () => {
      controller.abort();
    });

    await expect(
      uploadAudioFile(connection, file, { signal: controller.signal }),
    ).rejects.toThrow("Upload cancelled");

    expect(
      vi.mocked(api.sendAudioUploadChunk).mock.calls.length,
    ).toBeLessThanOrEqual(MAX_CHUNKS_IN_FLIGHT);
    expect(api.cancelAudioUpload).toHaveBeenCalledOnce();
  });

  it("splits the file into chunks the device accepts", async () => {
    await uploadAudioFile(connection, file);

    for (const [, chunk] of vi.mocked(api.sendAudioUploadChunk).mock.calls) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE);
    }
  });
});

describe("toStoredName", () => {
  it("stores every upload as a wav", () => {
    expect(toStoredName("song.mp3")).toBe("song.wav");
    expect(toStoredName("song.wav")).toBe("song.wav");
    expect(toStoredName("no extension")).toBe("no extension.wav");
  });

  it("keeps names that could be read as a path out of the protocol", () => {
    expect(toStoredName("../../etc/passwd.mp3")).toBe("_.._etc_passwd.wav");
    expect(toStoredName(".hidden.mp3")).toBe("hidden.wav");
    expect(toStoredName("ghost/howl.mp3")).toBe("ghost_howl.wav");
  });

  it("keeps names short enough for the device to store", () => {
    expect(toStoredName(`${"x".repeat(200)}.mp3`).length).toBeLessThanOrEqual(
      63,
    );
  });

  it("falls back to a usable name when nothing is left", () => {
    expect(toStoredName(".mp3")).toBe("audio.wav");
  });
});
