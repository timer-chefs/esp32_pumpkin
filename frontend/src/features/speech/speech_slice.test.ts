import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import { streamPcm, toDevicePcm } from "../../audio_file.ts";
import { effects } from "./effects.ts";
import { loadVoice, type PiperVoice, type Speech } from "./piper.ts";
import { speechSlice, type SpeechState } from "./speech_slice.ts";

vi.mock("./piper.ts", () => ({ loadVoice: vi.fn() }));
vi.mock("../../audio_file.ts", () => ({
  streamPcm: vi.fn(),
  toDevicePcm: vi.fn(),
}));
vi.mock("./effects.ts", () => ({
  effects: [
    { id: "growl", name: "Growl", lengthScale: 1.5, apply: vi.fn() },
    { id: "hiss", name: "Hiss", lengthScale: 0.8, apply: vi.fn() },
  ],
}));

const [growl, hiss] = effects;
const speech: Speech = { samples: new Float32Array(160), sampleRate: 22_050 };
const growled = new Float32Array(200);
const hissed = new Float32Array(120);
const pcm = new Int16Array(116);

/** The slice's actions over a state of its own, as the controller would set it up. */
function createSpeech(initial: Partial<SpeechState> = {}) {
  let state: SpeechState = { ...speechSlice.initialState, ...initial };
  const phases: SpeechState["phase"][] = [];
  const appActions = {
    audioSource: { stopStreaming: vi.fn().mockResolvedValue(undefined) },
    status: { set: vi.fn() },
  };
  const actions = speechSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
      if ("phase" in partial) {
        phases.push(state.phase);
      }
    },
    app: { actions: () => appActions } as unknown as AppAccess,
  });

  return { actions, appActions, phases, state: () => state };
}

function voiceSaying(result: Speech = speech): PiperVoice {
  return { synthesize: vi.fn().mockResolvedValue(result) };
}

/** A promise the test settles itself, to hold an action part way through. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(toDevicePcm).mockReturnValue(pcm);
  vi.mocked(streamPcm).mockResolvedValue(true);
  vi.mocked(growl.apply).mockReturnValue(growled);
  vi.mocked(hiss.apply).mockReturnValue(hissed);
});

describe("speechSlice", () => {
  it("says the text through the device with the chosen voice", async () => {
    const voice = voiceSaying();
    vi.mocked(loadVoice).mockResolvedValue(voice);
    const { actions, appActions, phases, state } = createSpeech({
      voiceId: "en_GB-alan-low",
    });

    actions.say("  Who goes there?  ");

    await vi.waitFor(() => expect(state().phase).toBeNull());
    expect(loadVoice).toHaveBeenCalledWith(
      "en_GB-alan-low",
      expect.any(Function),
    );
    expect(voice.synthesize).toHaveBeenCalledExactlyOnceWith(
      "Who goes there?",
      { lengthScale: 1.5 },
    );
    expect(growl.apply).toHaveBeenCalledExactlyOnceWith(speech.samples, 22_050);
    expect(appActions.audioSource.stopStreaming).toHaveBeenCalledOnce();
    expect(toDevicePcm).toHaveBeenCalledWith(growled, 22_050);
    expect(streamPcm).toHaveBeenCalledExactlyOnceWith(pcm);
    expect(phases).toEqual(["loading", "synthesizing", "speaking", null]);
    expect(appActions.status.set).toHaveBeenNthCalledWith(1, {
      mode: "Speech",
      streaming: "Who goes there?",
    });
    expect(appActions.status.set).toHaveBeenLastCalledWith({
      mode: "Idle",
      streaming: null,
    });
    expect(state().error).toBeNull();
  });

  it("says it with the effect that's picked", async () => {
    const voice = voiceSaying();
    vi.mocked(loadVoice).mockResolvedValue(voice);
    const { actions, state } = createSpeech();

    actions.selectEffect("hiss");
    actions.say("Boo");

    await vi.waitFor(() => expect(state().phase).toBeNull());
    expect(voice.synthesize).toHaveBeenCalledWith("Boo", { lengthScale: 0.8 });
    expect(growl.apply).not.toHaveBeenCalled();
    expect(toDevicePcm).toHaveBeenCalledWith(hissed, 22_050);
  });

  it("has nothing to say for blank text", () => {
    const { actions, state } = createSpeech();

    actions.say("   ");

    expect(loadVoice).not.toHaveBeenCalled();
    expect(state().phase).toBeNull();
  });

  it("shows how far the voice has downloaded, a megabyte at a time", async () => {
    const loading = deferred<PiperVoice>();
    vi.mocked(loadVoice).mockReturnValue(loading.promise);
    const { actions, state } = createSpeech();

    actions.say("Boo");
    const onDownload = vi.mocked(loadVoice).mock.calls[0][1]!;
    onDownload({ loaded: 1_000, total: 60_000_000 });
    onDownload({ loaded: 500_000, total: 60_000_000 });
    expect(state().download).toEqual({ loaded: 1_000, total: 60_000_000 });

    onDownload({ loaded: 2_000_000, total: 60_000_000 });
    expect(state().download).toEqual({ loaded: 2_000_000, total: 60_000_000 });

    loading.resolve(voiceSaying());
    await vi.waitFor(() => expect(state().phase).toBeNull());
    expect(state().download).toBeNull();
  });

  it("reports a voice that couldn't be got ready, leaving the device alone", async () => {
    vi.mocked(loadVoice).mockRejectedValue(new Error("network error"));
    const { actions, appActions, state } = createSpeech();

    actions.say("Boo");

    await vi.waitFor(() =>
      expect(state().error).toBe(
        "Could not get the voice ready: network error",
      ),
    );
    expect(state().phase).toBeNull();
    expect(appActions.audioSource.stopStreaming).not.toHaveBeenCalled();
    expect(streamPcm).not.toHaveBeenCalled();
  });

  it("reports speech that couldn't be worked out", async () => {
    vi.mocked(loadVoice).mockResolvedValue({
      synthesize: vi.fn().mockRejectedValue(new Error("Aborted()")),
    });
    const { actions, state } = createSpeech();

    actions.say("Boo");

    await vi.waitFor(() =>
      expect(state().error).toBe("Could not say it: Aborted()"),
    );
    expect(streamPcm).not.toHaveBeenCalled();
  });

  it("says nothing once stopped while the voice was getting ready", async () => {
    const loading = deferred<PiperVoice>();
    vi.mocked(loadVoice).mockReturnValue(loading.promise);
    const voice = voiceSaying();
    const { actions, appActions, state } = createSpeech();

    actions.say("Boo");
    actions.stop();
    expect(state().phase).toBeNull();

    loading.resolve(voice);
    await settle();
    expect(voice.synthesize).not.toHaveBeenCalled();
    expect(streamPcm).not.toHaveBeenCalled();
    // The device was never this one's to stop.
    expect(appActions.audioSource.stopStreaming).not.toHaveBeenCalled();
  });

  it("stops the device when stopped while speaking", async () => {
    const streaming = deferred<boolean>();
    vi.mocked(streamPcm).mockReturnValue(streaming.promise);
    vi.mocked(loadVoice).mockResolvedValue(voiceSaying());
    const { actions, appActions, state } = createSpeech();

    actions.say("Boo");
    await vi.waitFor(() => expect(state().phase).toBe("speaking"));
    appActions.audioSource.stopStreaming.mockClear();

    actions.stop();

    expect(state().phase).toBeNull();
    await vi.waitFor(() =>
      expect(appActions.audioSource.stopStreaming).toHaveBeenCalledOnce(),
    );
    streaming.resolve(false);
    await settle();
    // Whoever stopped it says what the device is doing now.
    expect(appActions.status.set).not.toHaveBeenCalledWith({
      mode: "Idle",
      streaming: null,
    });
  });

  it("lets a newer request take over from one still getting ready", async () => {
    const firstLoading = deferred<PiperVoice>();
    const voice = voiceSaying();
    vi.mocked(loadVoice)
      .mockReturnValueOnce(firstLoading.promise)
      .mockResolvedValueOnce(voice);
    const { actions, state } = createSpeech();

    actions.say("First");
    actions.say("Second");
    await vi.waitFor(() => expect(state().phase).toBeNull());
    firstLoading.resolve(voice);
    await settle();

    expect(voice.synthesize).toHaveBeenCalledExactlyOnceWith(
      "Second",
      expect.anything(),
    );
    expect(streamPcm).toHaveBeenCalledOnce();
  });
});
