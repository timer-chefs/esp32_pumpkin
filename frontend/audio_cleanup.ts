import { audioSessionManager } from "./audio_session_manager.ts";

import {
  clearFileStatus,
  setCurrentMode,
  setCurrentStreamingEnabled,
} from "./audio_ui.ts";

export async function stopAudio(): Promise<void> {
  await audioSessionManager.stop();

  clearFileStatus();
  setCurrentMode("Idle");
  setCurrentStreamingEnabled(false);
}
