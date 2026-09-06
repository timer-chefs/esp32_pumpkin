import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { streamAudioFile } from "../../audio_file.ts";
import { audioSessionManager, type AudioSession } from "../../audio_session.ts";
import api from "../../pumpkin_client.ts";
import workletUrl from "../../worklet_processor.ts?worker&url";

export type AudioSource = "microphone" | "file" | "sdCard";
export type MicrophoneStatus = "starting" | "streaming";
export type StatusTone = "neutral" | "success";

export interface AudioSourceState {
  active: AudioSource | null;
  fileStatus: { message: string; tone: StatusTone } | null;
  microphoneStatus: MicrophoneStatus | null;
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
}

export const audioSourceSlice: Slice<AudioSourceState, AudioSourceActions> = {
  initialState: {
    active: null,
    fileStatus: null,
    microphoneStatus: null,
    streamFileEnabled: false,
  },
  createActions: ({ update, app }) => {
    let selectedFile: File | null = null;

    const streamFile = (file: File) =>
      streamAudioFile(file, (message, tone = "neutral") => {
        update({ fileStatus: { message, tone } });
      });

    // Hands the device back from whatever is currently driving it.
    const stopAudio = async (): Promise<void> => {
      await audioSessionManager.stop();
      await app.actions().sdCard.stopPlaybackIfPlaying();

      update({ fileStatus: null, microphoneStatus: null });
      app.actions().status.set({ mode: "Idle", streaming: null });
    };

    const startMicrophone = async (): Promise<void> => {
      await stopAudio();
      update({ active: "microphone", microphoneStatus: "starting" });
      app.actions().status.set({ mode: "Starting microphone" });

      let session: AudioSession | null = null;
      try {
        session = await audioSessionManager.start({
          onError: (error) => console.error("Microphone session error:", error),
        });

        const mediaStream = await requestMicrophone();
        if (!audioSessionManager.isActive(session)) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        session.attachMediaStream(mediaStream);

        const audioContext = new AudioContext({ sampleRate: 16_000 });
        session.attachAudioContext(audioContext);
        await audioContext.audioWorklet.addModule(workletUrl);

        if (!audioSessionManager.isActive(session)) {
          return;
        }

        const sourceNode = audioContext.createMediaStreamSource(mediaStream);
        const processorNode = new AudioWorkletNode(
          audioContext,
          "pcm-processor",
        );
        session.attachSourceNode(sourceNode);
        session.attachProcessorNode(processorNode);
        processorNode.port.onmessage = (event) => session?.send(event.data);
        sourceNode.connect(processorNode);

        update({ microphoneStatus: "streaming" });
        app.actions().status.set({
          mode: "Microphone",
          streaming: "Microphone",
        });
      } catch (error) {
        console.error("Could not start microphone streaming:", error);
        if (session) {
          await audioSessionManager.stop(session, { notifyServer: false });
        }
        if (app.getState().audioSource.active === "microphone") {
          update({ active: null, microphoneStatus: null });
          app.actions().status.set({ mode: "Idle", streaming: null });
        }
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
    };
  },
};

async function requestMicrophone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    alert("Microphone access failed.");
    throw error;
  }
}

export function useAudioSource() {
  return useSlice("audioSource");
}
