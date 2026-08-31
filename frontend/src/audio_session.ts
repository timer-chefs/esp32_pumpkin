import {
  getPumpkinConnection,
  type PumpkinConnection,
} from "./pumpkin_connection.ts";

import api from "./pumpkin_client.ts";

export const AudioSessionState = {
  IDLE: "idle",
  CONNECTING: "connecting",
  STREAMING: "streaming",
  STOPPING: "stopping",
} as const;

export type AudioSessionState =
  (typeof AudioSessionState)[keyof typeof AudioSessionState];

export interface AudioSessionDependencies {
  hostname?: string;
  connectionFactory?: (hostname: string) => PumpkinConnection;
  resetAudioBuffer?: (connection: PumpkinConnection) => Promise<unknown>;
  onStateChange?: (state: AudioSessionState) => void;
  onError?: (error: Error) => void;
}

export interface StopAudioSessionOptions {
  notifyServer?: boolean;
  resetBuffer?: boolean;
}

export class AudioSession {
  readonly hostname: string;

  private readonly connectionFactory: (hostname: string) => PumpkinConnection;
  private readonly resetAudioBuffer: (
    connection: PumpkinConnection,
  ) => Promise<unknown>;
  private readonly onStateChange: (state: AudioSessionState) => void;
  private readonly onError: (error: Error) => void;
  private readonly abortController = new AbortController();

  private state: AudioSessionState = AudioSessionState.IDLE;
  private connection: PumpkinConnection | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: AudioWorkletNode | null = null;
  private stopPromise: Promise<void> | null = null;
  private connectionErrorHandler: (() => void) | null = null;
  private connectionCloseHandler: (() => void) | null = null;

  constructor({
    hostname = location.hostname,
    connectionFactory = getPumpkinConnection,
    resetAudioBuffer = api.resetAudio,
    onStateChange = () => {},
    onError = () => {},
  }: AudioSessionDependencies = {}) {
    this.hostname = hostname;
    this.connectionFactory = connectionFactory;
    this.resetAudioBuffer = resetAudioBuffer;
    this.onStateChange = onStateChange;
    this.onError = onError;
  }

  get currentState(): AudioSessionState {
    return this.state;
  }

  get isStreaming(): boolean {
    return this.state === AudioSessionState.STREAMING;
  }

  async start(): Promise<void> {
    if (this.state !== AudioSessionState.IDLE) {
      throw new Error(
        `Cannot start an audio session from state "${this.state}"`,
      );
    }

    this.setState(AudioSessionState.CONNECTING);
    const connection = this.connectionFactory(this.hostname);
    this.connection = connection;

    try {
      await connection.waitUntilOpen(this.abortController.signal);

      this.connectionErrorHandler = () => {
        this.onError(new Error("Audio WebSocket error"));
        void this.stop({ notifyServer: false });
      };
      this.connectionCloseHandler = () => {
        void this.stop({ notifyServer: false });
      };
      connection.addEventListener("error", this.connectionErrorHandler);
      connection.addEventListener("close", this.connectionCloseHandler);

      api.startAudioStream(connection);
      this.setState(AudioSessionState.STREAMING);
    } catch (error) {
      await this.stop({ notifyServer: false });
      throw error;
    }
  }

  send(data: ArrayBuffer | Uint8Array<ArrayBuffer>): boolean {
    const connection = this.connection;
    if (!connection || !this.isStreaming || !connection.isOpen) {
      return false;
    }

    const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
    api.sendAudioChunk(connection, chunk);
    return true;
  }

  attachMediaStream(mediaStream: MediaStream): void {
    this.mediaStream = mediaStream;
  }

  attachAudioContext(audioContext: AudioContext): void {
    this.audioContext = audioContext;
  }

  attachSourceNode(sourceNode: MediaStreamAudioSourceNode): void {
    this.sourceNode = sourceNode;
  }

  attachProcessorNode(processorNode: AudioWorkletNode): void {
    this.processorNode = processorNode;
  }

  wait(milliseconds: number): Promise<boolean> {
    if (this.abortController.signal.aborted) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = (completed: boolean) => {
        clearTimeout(timer);
        this.abortController.signal.removeEventListener("abort", onAbort);
        resolve(completed);
      };
      const onAbort = () => finish(false);
      timer = setTimeout(() => finish(true), milliseconds);

      this.abortController.signal.addEventListener("abort", onAbort, {
        once: true,
      });
    });
  }

  stop({
    notifyServer = true,
    resetBuffer = true,
  }: StopAudioSessionOptions = {}): Promise<void> {
    if (!this.stopPromise) {
      this.stopPromise = this.stopResources({ notifyServer, resetBuffer });
    }

    return this.stopPromise;
  }

  private async stopResources({
    notifyServer,
    resetBuffer,
  }: Required<StopAudioSessionOptions>): Promise<void> {
    this.setState(AudioSessionState.STOPPING);
    this.abortController.abort();

    const connection = this.connection;
    this.connection = null;

    if (connection && this.connectionErrorHandler) {
      connection.removeEventListener("error", this.connectionErrorHandler);
      this.connectionErrorHandler = null;
    }
    if (connection && this.connectionCloseHandler) {
      connection.removeEventListener("close", this.connectionCloseHandler);
      this.connectionCloseHandler = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.processorNode) {
      this.processorNode.port.onmessage = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (notifyServer && connection?.isOpen) {
      api.stopAudioStream(connection);
    }

    if (resetBuffer && connection?.isOpen) {
      await this.resetAudioBuffer(connection).catch((error) =>
        this.onError(toError(error)),
      );
    }

    this.setState(AudioSessionState.IDLE);
  }

  private setState(state: AudioSessionState): void {
    this.state = state;
    this.onStateChange(state);
  }
}

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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
