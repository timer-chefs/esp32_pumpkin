import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCached } from "./download_cache.ts";

// jsdom has no IndexedDB, so these are of a browser that can't keep
// anything: every file is downloaded afresh.

function respond(
  chunks: number[][],
  init: ResponseInit = { headers: { "Content-Length": "3" } },
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new Uint8Array(chunk)));
      controller.close();
    },
  });
  return new Response(body, init);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("fetchCached", () => {
  it("downloads a file, saying how far it has got", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respond([[1, 2], [3]]));
    const onProgress = vi.fn();

    const data = await fetchCached(
      "https://example.com/voice.onnx",
      onProgress,
    );

    expect([...new Uint8Array(data)]).toEqual([1, 2, 3]);
    expect(onProgress.mock.calls).toEqual([
      [{ loaded: 2, total: 3 }],
      [{ loaded: 3, total: 3 }],
    ]);
  });

  it("doesn't take a compressed file's length for its size", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      respond([[1, 2, 3, 4]], {
        headers: { "Content-Encoding": "br", "Content-Length": "2" },
      }),
    );
    const onProgress = vi.fn();

    await fetchCached("https://example.com/phonemizer.data", onProgress);

    expect(onProgress).toHaveBeenCalledExactlyOnceWith({ loaded: 4, total: 0 });
  });

  it("refuses a download that failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      respond([], { status: 404 }),
    );

    await expect(
      fetchCached("https://example.com/missing.onnx"),
    ).rejects.toThrow(
      "Could not download https://example.com/missing.onnx (404)",
    );
  });
});
