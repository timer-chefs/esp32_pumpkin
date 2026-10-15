import { fetchCached, type DownloadProgress } from "./download_cache.ts";

// The engine and its voices come from CDNs the first time they're needed,
// not with the page: together they're around 100 MB, far more than the
// device's flash holds. The versions are pinned so that what's been kept from
// an earlier visit is still what's asked for.
const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
const PHONEMIZER_URL =
  "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
const VOICES_URL =
  "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/";

export interface Speech {
  /** Mono, between -1 and 1. */
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
}

export interface SynthesisOptions {
  /** How much longer than usual to draw each sound out. */
  lengthScale?: number;
}

export interface PiperVoice {
  synthesize: (text: string, options?: SynthesisOptions) => Promise<Speech>;
}

// Only the parts of onnxruntime-web used here. It's loaded from the CDN, so
// its own types aren't to hand.
interface Ort {
  env: { wasm: { wasmBinary?: ArrayBuffer } };
  InferenceSession: {
    create: (
      model: ArrayBuffer,
      options: { executionProviders: string[] },
    ) => Promise<InferenceSession>;
  };
  Tensor: new (
    type: "int64" | "float32",
    data: BigInt64Array | Float32Array,
    dims: number[],
  ) => Tensor;
}

interface Tensor {
  data: unknown;
}

interface InferenceSession {
  run: (feeds: Record<string, Tensor>) => Promise<Record<string, Tensor>>;
  release: () => Promise<void>;
}

/** Piper's piper_phonemize command, built with Emscripten. */
type CreatePhonemizer = (module: {
  print: (line: string) => void;
  printErr: (line: string) => void;
  wasmBinary: ArrayBuffer;
  /** Its eSpeak data, which it would otherwise download itself. */
  getPreloadedPackage: () => ArrayBuffer;
}) => Promise<{ callMain: (args: string[]) => void }>;

/** What a voice's .onnx.json says about it, as far as it's used here. */
interface VoiceConfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  num_speakers: number;
}

interface Engine {
  ort: Ort;
  /** The phoneme IDs a voice takes, for text in an eSpeak language. */
  phonemize: (text: string, language: string) => Promise<number[]>;
}

interface LoadedVoice {
  config: VoiceConfig;
  session: InferenceSession;
  released: boolean;
}

let engine: Promise<Engine> | null = null;
let currentVoice: { id: string; loaded: Promise<LoadedVoice> } | null = null;

// A session can't run twice at once, and a voice mustn't be let go of while
// it's speaking, so whatever uses one waits its turn.
let queue: Promise<unknown> = Promise.resolve();

// What's downloading at the moment, for anyone waiting on any of it to
// follow, not just whoever happened to start it.
const downloads = new Map<string, DownloadProgress>();
const downloadListeners = new Set<(progress: DownloadProgress) => void>();
let activeDownloads = 0;

/**
 * Gets a voice ready to speak with, downloading it and the engine the first
 * time. Only one voice is held at a time, as each takes a lot of memory.
 */
export async function loadVoice(
  id: string,
  onDownload?: (progress: DownloadProgress) => void,
): Promise<PiperVoice> {
  if (onDownload) {
    downloadListeners.add(onDownload);
  }

  try {
    const [{ ort, phonemize }, voice] = await Promise.all([
      getEngine(),
      getVoice(id),
    ]);
    const { config, session } = voice;

    return {
      synthesize: (text, { lengthScale = 1 } = {}) =>
        enqueue(async () => {
          if (voice.released) {
            throw new Error("Another voice has been picked since");
          }

          const ids = await phonemize(text, config.espeak.voice);
          const { noise_scale, length_scale, noise_w } = config.inference;
          const feeds: Record<string, Tensor> = {
            input: new ort.Tensor(
              "int64",
              BigInt64Array.from(ids, (phonemeId) => BigInt(phonemeId)),
              [1, ids.length],
            ),
            input_lengths: new ort.Tensor(
              "int64",
              BigInt64Array.of(BigInt(ids.length)),
              [1],
            ),
            scales: new ort.Tensor(
              "float32",
              Float32Array.of(noise_scale, length_scale * lengthScale, noise_w),
              [3],
            ),
          };
          // A voice with several speakers has to be told which one; the
          // first will do.
          if (config.num_speakers > 1) {
            feeds.sid = new ort.Tensor("int64", BigInt64Array.of(0n), [1]);
          }

          const { output } = await session.run(feeds);
          return {
            samples: output.data as Float32Array<ArrayBuffer>,
            sampleRate: config.audio.sample_rate,
          };
        }),
    };
  } finally {
    if (onDownload) {
      downloadListeners.delete(onDownload);
    }
  }
}

function getEngine(): Promise<Engine> {
  engine ??= loadEngine().catch((error) => {
    engine = null;
    throw error;
  });
  return engine;
}

async function loadEngine(): Promise<Engine> {
  const [ort, ortWasm, , phonemizerWasm, phonemizerData] = await Promise.all([
    import(/* @vite-ignore */ `${ORT_URL}ort.wasm.min.mjs`) as Promise<Ort>,
    downloadFile(`${ORT_URL}ort-wasm-simd-threaded.wasm`),
    loadScript(`${PHONEMIZER_URL}.js`),
    downloadFile(`${PHONEMIZER_URL}.wasm`),
    downloadFile(`${PHONEMIZER_URL}.data`),
  ]);
  ort.env.wasm.wasmBinary = ortWasm;

  // It's an Emscripten script rather than a module, so it leaves its
  // factory behind as a global.
  const createPhonemizer = (
    window as unknown as { createPiperPhonemize: CreatePhonemizer }
  ).createPiperPhonemize;

  return {
    ort,
    phonemize: async (text, language) => {
      // A fresh one each time: one that's run again leaks, until after a
      // hundred or so it aborts and stays broken.
      const output: string[] = [];
      const phonemizer = await createPhonemizer({
        print: (line) => output.push(line),
        printErr: (line) => console.warn("Phonemizer:", line),
        wasmBinary: phonemizerWasm,
        getPreloadedPackage: () => phonemizerData,
      });

      phonemizer.callMain([
        "-l",
        language,
        "--input",
        JSON.stringify([{ text }]),
        "--espeak_data",
        "/espeak-ng-data",
      ]);
      if (output.length === 0) {
        throw new Error("Could not work out how to say it");
      }
      return (JSON.parse(output[0]) as { phoneme_ids: number[] }).phoneme_ids;
    },
  };
}

function getVoice(id: string): Promise<LoadedVoice> {
  if (currentVoice?.id === id) {
    return currentVoice.loaded;
  }

  const previous = currentVoice;
  const loaded = loadVoiceFiles(id);
  currentVoice = { id, loaded };
  loaded.catch(() => {
    if (currentVoice?.loaded === loaded) {
      currentVoice = null;
    }
  });

  // One that never loaded has nothing to let go of.
  previous?.loaded.then(
    (voice) => enqueue(() => release(voice)),
    () => {},
  );
  return loaded;
}

async function loadVoiceFiles(id: string): Promise<LoadedVoice> {
  const url = voiceUrl(id);
  const [{ ort }, config, model] = await Promise.all([
    getEngine(),
    downloadFile(`${url}.json`).then(
      (data) => JSON.parse(new TextDecoder().decode(data)) as VoiceConfig,
    ),
    downloadFile(url),
  ]);

  return {
    config,
    session: await ort.InferenceSession.create(model, {
      executionProviders: ["wasm"],
    }),
    released: false,
  };
}

async function release(voice: LoadedVoice): Promise<void> {
  voice.released = true;
  await voice.session
    .release()
    .catch((error) => console.warn("Could not let go of a voice:", error));
}

/** Where Piper keeps a voice: by language, locale, speaker and quality. */
function voiceUrl(id: string): string {
  const [locale, speaker, quality] = id.split("-");
  const language = locale.split("_")[0];
  return `${VOICES_URL}${language}/${locale}/${speaker}/${quality}/${id}.onnx`;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

async function downloadFile(url: string): Promise<ArrayBuffer> {
  activeDownloads++;

  try {
    return await fetchCached(url, (progress) => {
      downloads.set(url, progress);

      let loaded = 0;
      let total = 0;
      for (const download of downloads.values()) {
        loaded += download.loaded;
        // One whose size isn't known counts as done as far as it's got.
        total += Math.max(download.total, download.loaded);
      }
      downloadListeners.forEach((listener) => listener({ loaded, total }));
    });
  } finally {
    if (--activeDownloads === 0) {
      downloads.clear();
    }
  }
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.append(script);
  });
}
