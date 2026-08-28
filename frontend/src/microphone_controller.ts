import { stopAudio } from "./audio_cleanup.ts";

import { audioSessionManager } from "./audio_session_manager.ts";

import {
  hideMicrophoneMode,
  setCurrentMode,
  setCurrentStreaming,
  showMicrophoneMode,
} from "./audio_ui.ts";

import type { AudioSession } from "./audio_session.ts";
import workletUrl from "./worklet_processor.ts?worker&url";

export async function switchToMicrophone(): Promise<void> {
  await stopAudio();
  showMicrophoneMode();

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

    const audioContext = new AudioContext({ sampleRate: 16000 });
    session.attachAudioContext(audioContext);
    await audioContext.audioWorklet.addModule(workletUrl);

    if (!audioSessionManager.isActive(session)) {
      return;
    }

    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    const processorNode = new AudioWorkletNode(audioContext, "pcm-processor");
    session.attachSourceNode(sourceNode);
    session.attachProcessorNode(processorNode);

    processorNode.port.onmessage = (event) => session?.send(event.data);
    sourceNode.connect(processorNode);

    console.log(`Streaming microphone at ${audioContext.sampleRate}Hz`);
    setCurrentMode("Microphone");
    setCurrentStreaming("Microphone");
  } catch (error) {
    console.error("Could not start microphone streaming:", error);
    if (session) {
      await audioSessionManager.stop(session, { notifyServer: false });
    }
    hideMicrophoneMode();
  }
}

export async function stopMicrophone(): Promise<void> {
  await stopAudio();
  hideMicrophoneMode();
}

async function requestMicrophone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    alert("Microphone access failed.");
    throw error;
  }
}
