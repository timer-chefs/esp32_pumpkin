import { audioSessionManager } from "./audio_session_manager.ts";

import { setFileStatus } from "./audio_ui.ts";

const CHUNK_SIZE = 512;
const BYTES_PER_SECOND = 16000 * Int16Array.BYTES_PER_ELEMENT;

export async function streamAudioData(audioBuffer: ArrayBuffer): Promise<void> {
  const session = await audioSessionManager.start({
    onError: (error) => console.error("Audio session error:", error),
  });
  const data = new Uint8Array(audioBuffer);
  const startTime = performance.now();
  let bytesSent = 0;
  let updateCount = 0;

  console.log(
    `Starting stream: ${data.length} bytes (${data.length / 2} Int16 samples)`,
  );
  setFileStatus("Streaming...");

  try {
    for (let offset = 0; offset < data.length;) {
      if (!audioSessionManager.isActive(session)) {
        return;
      }

      const chunk = data.slice(
        offset,
        Math.min(offset + CHUNK_SIZE, data.length),
      );
      if (!session.send(chunk)) {
        throw new Error("Audio session stopped before streaming completed");
      }

      offset += chunk.length;
      bytesSent += chunk.length;

      if (updateCount++ % 50 === 0) {
        const progress = Math.round((offset / data.length) * 100);
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        setFileStatus(
          `Streaming: ${progress}% (${bytesSent} bytes, ${elapsed}s)`,
        );
      }

      const elapsedMilliseconds = performance.now() - startTime;
      const targetElapsedMilliseconds = (bytesSent / BYTES_PER_SECOND) * 1000;
      const delayMilliseconds = Math.max(
        0,
        Math.round(targetElapsedMilliseconds - elapsedMilliseconds),
      );

      if (!(await session.wait(delayMilliseconds))) {
        return;
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`Streaming complete: ${bytesSent} bytes in ${elapsed}s`);
    setFileStatus(
      `Complete! (${bytesSent} bytes in ${elapsed}s)`,
      "success",
    );

    if (await session.wait(500)) {
      await audioSessionManager.stop(session);
    }
  } catch (error) {
    await audioSessionManager.stop(session, { notifyServer: false });
    throw error;
  }
}
