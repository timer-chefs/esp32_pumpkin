import {
  closeAudioSocket,
  createAudioSocket,
  isSocketOpen,
} from "./audio_socket.ts";

import { sendCommand } from "./command_sender.ts";

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
  resetAudioBuffer?: () => Promise<unknown>;
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
  private readonly resetAudioBuffer: () => Promise<unknown>;
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

  constructor({
    hostname = location.hostname,
    socketFactory = createAudioSocket,
    resetAudioBuffer = () => fetch("/api/audio/reset"),
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
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (complete: () => void) => {
          if (settled) {
            return;
          }

          settled = true;
          this.abortController.signal.removeEventListener("abort", onAbort);
          complete();
        };
        const onAbort = () =>
          settle(() => {
            reject(new DOMException("Audio session stopped", "AbortError"));
          });

        socket.onopen = () => {
          if (this.abortController.signal.aborted) {
            onAbort();
            return;
          }

          sendCommand(socket, { command: "START_AUDIO_STREAM" });
          this.setState(AudioSessionState.STREAMING);
          settle(resolve);
        };

        socket.onerror = () => {
          const error = new Error("Audio WebSocket error");
          if (this.state === AudioSessionState.CONNECTING) {
            settle(() => reject(error));
          } else {
            this.onError(error);
            void this.stop({ notifyServer: false });
          }
        };

        socket.onclose = () => {
          if (this.state === AudioSessionState.CONNECTING) {
            settle(() => {
              reject(new Error("Audio WebSocket closed before connecting"));
            });
          } else if (this.state === AudioSessionState.STREAMING) {
            void this.stop({ notifyServer: false });
          }
        };

        this.abortController.signal.addEventListener("abort", onAbort, {
          once: true,
        });
      });
    } catch (error) {
      await this.stop({ notifyServer: false });
      throw error;
    }
  }

  send(
    data: string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>,
  ): boolean {
    const socket = this.socket;
    if (!socket || !this.isStreaming || !isSocketOpen(socket)) {
      return false;
    }

    socket.send(data);
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
      sendCommand(socket, { command: "STOP_AUDIO_STREAM" });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    closeAudioSocket(socket);

    if (resetBuffer) {
      await this.resetAudioBuffer().catch((error) =>
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
