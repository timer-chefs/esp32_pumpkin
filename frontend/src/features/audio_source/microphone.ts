import { audioSessionManager, type AudioSession } from "../../audio_session.ts";
import type { LightScene } from "../../pumpkin_client.ts";
import workletUrl from "../../worklet_processor.ts?worker&url";

/**
 * Starts a session that streams the microphone to the device, through the
 * voice effect if one's given, and lit with `light` if that is. Resolves to null if the session was stopped
 * or replaced before the microphone was ready, in which case nothing is
 * left running.
 */
export async function streamMicrophone(
  effectId?: string,
  light?: LightScene,
): Promise<AudioSession | null> {
  const session = await audioSessionManager.start({
    light,
    onError: (error) => console.error("Microphone session error:", error),
  });

  try {
    const mediaStream = await requestMicrophone();
    if (!audioSessionManager.isActive(session)) {
      mediaStream.getTracks().forEach((track) => track.stop());
      return null;
    }
    session.attachMediaStream(mediaStream);

    const audioContext = new AudioContext({ sampleRate: 16_000 });
    session.attachAudioContext(audioContext);
    await audioContext.audioWorklet.addModule(workletUrl);

    if (!audioSessionManager.isActive(session)) {
      return null;
    }

    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    const processorNode = new AudioWorkletNode(audioContext, "pcm-processor", {
      processorOptions: { effect: effectId },
    });
    session.attachSourceNode(sourceNode);
    session.attachProcessorNode(processorNode);
    processorNode.port.onmessage = (event) => session.send(event.data);
    sourceNode.connect(processorNode);

    return session;
  } catch (error) {
    await audioSessionManager.stop(session, { notifyServer: false });
    throw error;
  }
}

async function requestMicrophone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    alert("Microphone access failed.");
    throw error;
  }
}
