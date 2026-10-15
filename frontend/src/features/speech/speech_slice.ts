import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { streamPcm, toDevicePcm } from "../../audio_file.ts";
import { toError } from "../../to_error.ts";
import type { DownloadProgress } from "./download_cache.ts";
import { effects } from "./effects.ts";
import { loadVoice } from "./piper.ts";
import { voices } from "./voices.ts";

// A voice comes down in thousands of pieces, and showing each one would
// redraw the page as many times.
const DOWNLOAD_PROGRESS_STEP = 1024 * 1024;

/**
 * Getting the voice ready (downloading it the first time), working out the
 * speech, then streaming it to the device.
 */
export type SpeechPhase = "loading" | "synthesizing" | "speaking";

export interface SpeechState {
  voiceId: string;
  effectId: string;
  /** Null unless something is being said. */
  phase: SpeechPhase | null;
  /** Null unless the voice is downloading, which it only does the first time. */
  download: DownloadProgress | null;
  error: string | null;
}

export interface SpeechActions {
  selectVoice: (id: string) => void;
  selectEffect: (id: string) => void;
  /** Says the text through the pumpkin. */
  say: (text: string) => void;
  stop: () => void;
}

export const speechSlice: Slice<SpeechState, SpeechActions> = {
  initialState: {
    voiceId: voices[0].id,
    effectId: effects[0].id,
    phase: null,
    download: null,
    error: null,
  },
  createActions: ({ getState, update, app }) => {
    // Each request gets its own number, so one that has been stopped or
    // replaced can tell, once its speech is ready, that nobody wants it.
    let lastRequest = 0;

    const say = async (text: string): Promise<void> => {
      const words = text.trim();
      if (!words) {
        return;
      }

      const request = ++lastRequest;
      const isCurrent = () => request === lastRequest;
      const { voiceId, effectId } = getState();
      const effect =
        effects.find((effect) => effect.id === effectId) ?? effects[0];
      update({ phase: "loading", download: null, error: null });

      const showDownload = (download: DownloadProgress) => {
        const shown = getState().download;
        if (
          isCurrent() &&
          (!shown ||
            download.loaded < shown.loaded ||
            download.loaded - shown.loaded >= DOWNLOAD_PROGRESS_STEP)
        ) {
          update({ download });
        }
      };

      let failure = "Could not get the voice ready";
      try {
        const voice = await loadVoice(voiceId, showDownload);
        if (!isCurrent()) {
          return;
        }

        failure = "Could not say it";
        update({ phase: "synthesizing", download: null });
        const speech = await voice.synthesize(words, {
          lengthScale: effect.lengthScale,
        });
        const samples = effect.apply(speech.samples, speech.sampleRate);
        if (!isCurrent()) {
          return;
        }

        // Whatever the device was playing carries on until now, rather than
        // going quiet while the voice gets ready.
        await app.actions().audioSource.stopStreaming();
        if (!isCurrent()) {
          return;
        }
        update({ phase: "speaking" });
        app.actions().status.set({ mode: "Speech", streaming: words });

        const finished = await streamPcm(
          toDevicePcm(samples, speech.sampleRate),
        );
        // Whatever cut it short has set the status to what it's doing.
        if (finished && isCurrent()) {
          app.actions().status.set({ mode: "Idle", streaming: null });
        }
      } catch (error) {
        if (isCurrent()) {
          console.error(`${failure}:`, error);
          update({ error: `${failure}: ${toError(error).message}` });
        }
      } finally {
        if (isCurrent()) {
          update({ phase: null, download: null });
        }
      }
    };

    const stop = async (): Promise<void> => {
      const { phase } = getState();
      lastRequest++;
      update({ phase: null, download: null });

      // Until it's speaking, the device is still whoever had it before. A
      // download carries on regardless, so it's there the next time.
      if (phase === "speaking") {
        await app.actions().audioSource.stopStreaming();
      }
    };

    return {
      selectVoice: (id) => update({ voiceId: id }),
      selectEffect: (id) => update({ effectId: id }),
      say: (text) => runAction(() => say(text)),
      stop: () => runAction(stop),
    };
  },
};

export function useSpeech() {
  return useSlice("speech");
}
