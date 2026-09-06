import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { audioSessionManager } from "../../audio_session.ts";
import api, { type AudioFileInfo } from "../../pumpkin_client.ts";
import { toError } from "../../to_error.ts";
import {
  toStoredName,
  uploadAudioFile,
  type UploadPhase,
} from "./audio_upload.ts";

export interface UploadState {
  name: string;
  // Decoding and resampling the file in the browser comes first; only then
  // is there a byte count to make progress against. The device has the last
  // word, reading the file back off the card before it accepts it.
  phase: "converting" | UploadPhase;
  bytesSent: number;
  totalBytes: number;
  bytesPerSecond: number | null;
  secondsRemaining: number | null;
}

export interface SdCardState {
  error: string | null;
  /** Null until the card has been listed for the first time. */
  files: AudioFileInfo[] | null;
  isLoading: boolean;
  playingFile: string | null;
  upload: UploadState | null;
}

export interface SdCardActions {
  refresh: () => void;
  playFile: (name: string) => void;
  stopPlayback: () => void;
  /** Used by whoever takes the device over, so playback doesn't outlive it. */
  stopPlaybackIfPlaying: () => Promise<void>;
  uploadFile: (file: File) => void;
  cancelUpload: () => void;
}

export const sdCardSlice: Slice<SdCardState, SdCardActions> = {
  initialState: {
    error: null,
    files: null,
    isLoading: false,
    playingFile: null,
    upload: null,
  },
  createActions: ({ getState, update, app }) => {
    let uploadAbortController: AbortController | null = null;

    const refresh = async (): Promise<void> => {
      update({ error: null, isLoading: true });

      try {
        update({
          files: await api.listAudioFiles(await app.connection()),
          isLoading: false,
        });
      } catch (error) {
        console.error("Could not list the SD card:", error);
        update({ error: "Could not read the SD card", isLoading: false });
      }
    };

    const stopPlaybackIfPlaying = async (): Promise<void> => {
      if (!getState().playingFile) {
        return;
      }

      try {
        api.stopAudioStream(await app.connection());
      } catch (error) {
        console.warn("Could not stop SD card playback:", error);
      }

      update({ playingFile: null });
    };

    return {
      refresh: () => runAction(refresh),

      playFile: (name) =>
        runAction(async () => {
          // The device plays this one on its own, so hand back whatever the
          // browser was streaming before asking for it.
          await audioSessionManager.stop();

          try {
            await api.playAudioFile(await app.connection(), name);
            update({ playingFile: name, error: null });
            app.actions().status.set({ mode: "SD card", streaming: name });
          } catch (error) {
            console.error(`Could not play "${name}" from the SD card:`, error);
            update({ playingFile: null, error: toError(error).message });
          }
        }),

      stopPlayback: () =>
        runAction(async () => {
          await stopPlaybackIfPlaying();
          app.actions().status.set({ streaming: null });
        }),

      stopPlaybackIfPlaying,

      uploadFile: (file) =>
        runAction(async () => {
          if (uploadAbortController) {
            return;
          }

          const controller = new AbortController();
          uploadAbortController = controller;

          const name = toStoredName(file.name);
          update({
            error: null,
            upload: {
              name,
              phase: "converting",
              bytesSent: 0,
              totalBytes: 0,
              bytesPerSecond: null,
              secondsRemaining: null,
            },
          });

          try {
            await uploadAudioFile(await app.connection(), file, {
              signal: controller.signal,
              onProgress: (progress) =>
                update({ upload: { name, ...progress } }),
            });

            await refresh();
          } catch (error) {
            if (!isAbortError(error)) {
              console.error(`Could not upload "${name}":`, error);
              update({ error: toError(error).message });
            }
          } finally {
            if (uploadAbortController === controller) {
              uploadAbortController = null;
            }
            update({ upload: null });
          }
        }),

      cancelUpload: () => uploadAbortController?.abort(),
    };
  },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useSdCard() {
  return useSlice("sdCard");
}
