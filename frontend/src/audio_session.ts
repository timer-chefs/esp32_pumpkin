import {
  getAudioSocket,
  isSocketOpen,
  waitForAudioSocket,
} from "./audio_socket.ts";

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
  socketFactory?: (hostname: string) => WebSocket;
  resetAudioBuffer?: (socket: WebSocket) => Promise<unknown>;
  onStateChange?: (state: AudioSessionState) => void;
  onError?: (error: Error) => void;
}

export interface StopAudioSessionOptions {
  notifyServer?: boolean;
  resetBuffer?: boolean;
}

export class AudioSession {
  readonly hostname: string;

  private readonly socketFactory: (hostname: string) => WebSocket;
  private readonly resetAudioBuffer: (socket: WebSocket) => Promise<unknown>;
  private readonly onStateChange: (state: AudioSessionState) => void;
  private readonly onError: (error: Error) => void;
  private readonly abortController = new AbortController();

  private state: AudioSessionState = AudioSessionState.IDLE;
  private socket: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: AudioWorkletNode | null = null;
  private stopPromise: Promise<void> | null = null;
  private socketErrorHandler: (() => void) | null = null;
  private socketCloseHandler: (() => void) | null = null;

  constructor({
    hostname = location.hostname,
    socketFactory = getAudioSocket,
    resetAudioBuffer = api.resetAudio,
    onStateChange = () => {},
    onError = () => {},
  }: AudioSessionDependencies = {}) {
    this.hostname = hostname;
    this.socketFactory = socketFactory;
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
    const socket = this.socketFactory(this.hostname);
    this.socket = socket;

    try {
      await waitForAudioSocket(socket, this.abortController.signal);

      this.socketErrorHandler = () => {
        this.onError(new Error("Audio WebSocket error"));
        void this.stop({ notifyServer: false });
      };
      this.socketCloseHandler = () => {
        void this.stop({ notifyServer: false });
      };
      socket.addEventListener("error", this.socketErrorHandler);
      socket.addEventListener("close", this.socketCloseHandler);

      api.startAudioStream(socket);
      this.setState(AudioSessionState.STREAMING);
    } catch (error) {
      await this.stop({ notifyServer: false });
      throw error;
    }
  }

  send(data: ArrayBuffer | Uint8Array<ArrayBuffer>): boolean {
    const socket = this.socket;
    if (!socket || !this.isStreaming || !isSocketOpen(socket)) {
      return false;
    }

    const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
    api.sendAudioChunk(socket, chunk);
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

    const socket = this.socket;
    this.socket = null;

    if (socket && this.socketErrorHandler) {
      socket.removeEventListener("error", this.socketErrorHandler);
      this.socketErrorHandler = null;
    }
    if (socket && this.socketCloseHandler) {
      socket.removeEventListener("close", this.socketCloseHandler);
      this.socketCloseHandler = null;
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

    if (notifyServer && isSocketOpen(socket)) {
      api.stopAudioStream(socket);
    }

    if (resetBuffer && isSocketOpen(socket)) {
      await this.resetAudioBuffer(socket).catch((error) =>
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
