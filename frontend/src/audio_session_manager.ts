import {
  AudioSession,
  AudioSessionState,
  type AudioSessionDependencies,
  type StopAudioSessionOptions,
} from "./audio_session.ts";

class AudioSessionManager {
  private activeSession: AudioSession | null = null;

  async start(
    dependencies: AudioSessionDependencies = {},
  ): Promise<AudioSession> {
    await this.stop();

    const callerOnStateChange = dependencies.onStateChange;
    let session: AudioSession;
    session = new AudioSession({
      ...dependencies,
      onStateChange: (state) => {
        if (
          state === AudioSessionState.IDLE &&
          this.activeSession === session
        ) {
          this.activeSession = null;
        }
        callerOnStateChange?.(state);
      },
    });
    this.activeSession = session;

    try {
      await session.start();
      return session;
    } catch (error) {
      if (this.activeSession === session) {
        this.activeSession = null;
      }
      throw error;
    }
  }

  isActive(session: AudioSession): boolean {
    return this.activeSession === session;
  }

  async stop(
    session: AudioSession | null = this.activeSession,
    options?: StopAudioSessionOptions,
  ): Promise<void> {
    if (!session) {
      return;
    }

    if (this.activeSession === session) {
      this.activeSession = null;
    }

    await session.stop(options);
  }
}

export const audioSessionManager = new AudioSessionManager();
