import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { streamAudioFile } from "../../audio_file.ts";
import { audioSessionManager, type AudioSession } from "../../audio_session.ts";
import api from "../../pumpkin_client.ts";
import { streamMicrophone } from "./microphone.ts";

export type AudioSource = "microphone" | "file" | "sdCard";
export type MicrophoneStatus = "starting" | "streaming";
export type PushToTalkStatus = "starting" | "talking";
export type StatusTone = "neutral" | "success";

// How long a push-to-talk session stays open after the button is let go:
// long enough for what the device has buffered to play out, so the last word
// isn't clipped.
const TALK_TAIL_MS = 250;

export interface AudioSourceState {
  active: AudioSource | null;
  fileStatus: { message: string; tone: StatusTone } | null;
  microphoneStatus: MicrophoneStatus | null;
  /** Null unless the push-to-talk button is being held. */
  pushToTalk: PushToTalkStatus | null;
  streamFileEnabled: boolean;
}

export interface AudioSourceActions {
  selectFile: (file: File | null) => void;
  /** Streams a file from the browser, reporting progress as the file status. */
  streamFile: (file: File) => Promise<void>;
  startFile: () => void;
  startFileMode: () => void;
  startMicrophone: () => void;
  startSdCardMode: () => void;
  stopAudio: () => void;
  stopMicrophone: () => void;
  /** Streams the microphone for as long as the button stays pressed. */
  pressToTalk: () => void;
  releaseToTalk: () => void;
  /** Used by whoever takes the device over, so nothing streamed from here outlives it. */
  stopStreaming: () => Promise<void>;
}

export const audioSourceSlice: Slice<AudioSourceState, AudioSourceActions> = {
  initialState: {
    active: null,
    fileStatus: null,
    microphoneStatus: null,
    pushToTalk: null,
    streamFileEnabled: false,
  },
  createActions: ({ getState, update, app }) => {
    let selectedFile: File | null = null;

    // Each push-to-talk press gets its own number, so a press that was let
    // go while its session was still starting can tell, once it has
    // started, that nobody wants it any more.
    let lastPress = 0;
    let heldPress = 0;
    let talkSession: AudioSession | null = null;

    const streamFile = (file: File) =>
      streamAudioFile(file, (message, tone = "neutral") => {
        update({ fileStatus: { message, tone } });
      });

    const endTalk = () => {
      heldPress = 0;
      talkSession = null;
      update({ pushToTalk: null });
    };

    // Hands the device back from whatever is currently driving it.
    const releaseDevice = async (): Promise<void> => {
      await audioSessionManager.stop();
      await app.actions().sdCard.stopPlaybackIfPlaying();

      const { active } = getState();
      update({
        // The other sources keep their controls up once stopped, but the
        // microphone has nothing left to show.
        active: active === "microphone" ? null : active,
        fileStatus: null,
        microphoneStatus: null,
      });
      app.actions().status.set({ mode: "Idle", streaming: null });
    };

    const stopAudio = async (): Promise<void> => {
      endTalk();
      await releaseDevice();
    };

    const startMicrophone = async (): Promise<void> => {
      await stopAudio();
      update({ active: "microphone", microphoneStatus: "starting" });
      app.actions().status.set({ mode: "Starting microphone" });

      try {
        if (!(await streamMicrophone())) {
          return;
        }

        update({ microphoneStatus: "streaming" });
        app.actions().status.set({
          mode: "Microphone",
          streaming: "Microphone",
        });
      } catch (error) {
        console.error("Could not start microphone streaming:", error);
        if (getState().active === "microphone") {
          update({ active: null, microphoneStatus: null });
          app.actions().status.set({ mode: "Idle", streaming: null });
        }
      }
    };

    const pressToTalk = async (): Promise<void> => {
      if (heldPress) {
        return;
      }

      const press = ++lastPress;
      heldPress = press;
      const isHeld = () => heldPress === press;
      update({ pushToTalk: "starting" });

      try {
        await releaseDevice();
        if (!isHeld()) {
          return;
        }
        app.actions().status.set({ mode: "Push to talk" });

        const session = await streamMicrophone();
        if (!isHeld()) {
          if (session) {
            await audioSessionManager.stop(session);
          }
          return;
        }
        if (!session) {
          // Something else took the device over while this was starting.
          endTalk();
          return;
        }

        talkSession = session;
        update({ pushToTalk: "talking" });
        app.actions().status.set({ streaming: "Microphone" });
      } catch (error) {
        console.error("Could not start push to talk:", error);
        if (isHeld()) {
          endTalk();
          app.actions().status.set({ mode: "Idle", streaming: null });
        }
      }
    };

    const releaseToTalk = async (): Promise<void> => {
      if (!heldPress) {
        return;
      }

      const session = talkSession;
      endTalk();
      app.actions().status.set({ mode: "Idle", streaming: null });

      // A press let go before its session was up stops that session itself,
      // once it has one (see pressToTalk).
      if (!session) {
        return;
      }

      session.stopCapture();
      if (await session.wait(TALK_TAIL_MS)) {
        await audioSessionManager.stop(session);
      }
    };

    return {
      selectFile: (file) => {
        selectedFile = file;
        update({
          fileStatus: file
            ? {
                message: `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
                tone: "neutral",
              }
            : null,
          streamFileEnabled: file !== null,
        });
      },

      streamFile,

      startFile: () =>
        runAction(async () => {
          const file = selectedFile;
          if (!file) {
            alert("Please select an audio file first");
            return;
          }

          try {
            await api.resetAudio(await app.connection());
          } catch (error) {
            console.warn("Could not reset audio buffer:", error);
          }

          try {
            await streamFile(file);
            app.actions().status.set({ streaming: file.name });
          } catch (error) {
            console.error("Could not stream audio file:", error);
            alert(
              "Failed to process audio file. Make sure it's a valid audio file.",
            );
          }
        }),

      startFileMode: () =>
        runAction(async () => {
          await stopAudio();
          update({ active: "file" });
          app.actions().status.set({ mode: "Audio File" });
        }),

      startMicrophone: () => runAction(startMicrophone),

      startSdCardMode: () =>
        runAction(async () => {
          await stopAudio();
          update({ active: "sdCard" });
          app.actions().status.set({ mode: "SD card" });
          app.actions().sdCard.refresh();
        }),

      stopAudio: () => runAction(stopAudio),

      stopMicrophone: () =>
        runAction(async () => {
          await stopAudio();
          update({ active: null });
        }),

      pressToTalk: () => runAction(pressToTalk),

      releaseToTalk: () => runAction(releaseToTalk),

      stopStreaming: stopAudio,
    };
  },
};

export function useAudioSource() {
  return useSlice("audioSource");
}
