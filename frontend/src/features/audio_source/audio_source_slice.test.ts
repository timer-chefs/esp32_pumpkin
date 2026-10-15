import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import type { AudioSession } from "../../audio_session.ts";
import {
  audioSourceSlice,
  type AudioSourceState,
} from "./audio_source_slice.ts";
import { voiceLight } from "../voice_effect/voice_light.ts";
import { streamMicrophone } from "./microphone.ts";

vi.mock("./microphone.ts", () => ({ streamMicrophone: vi.fn() }));

/** The slice's actions over a state of its own, as the controller would set it up. */
function createAudioSource(effectId = "demon") {
  let state: AudioSourceState = { ...audioSourceSlice.initialState };
  const appActions = {
    sdCard: { stopPlaybackIfPlaying: vi.fn().mockResolvedValue(undefined) },
    status: { set: vi.fn() },
  };
  const actions = audioSourceSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: {
      actions: () => appActions,
      getState: () => ({ voiceEffect: { effectId } }),
    } as unknown as AppAccess,
  });

  return { actions, state: () => state };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(streamMicrophone).mockResolvedValue({} as AudioSession);
});

describe("audioSourceSlice", () => {
  it("talks with the voice effect that's picked, lit by the voice", async () => {
    const { actions, state } = createAudioSource("witch");

    actions.pressToTalk();

    await vi.waitFor(() => expect(state().pushToTalk).toBe("talking"));
    expect(streamMicrophone).toHaveBeenCalledExactlyOnceWith(
      "witch",
      voiceLight,
    );
  });

  it("streams the microphone source as it is", async () => {
    const { actions, state } = createAudioSource("witch");

    actions.startMicrophone();

    await vi.waitFor(() => expect(state().microphoneStatus).toBe("streaming"));
    expect(streamMicrophone).toHaveBeenCalledExactlyOnceWith();
  });
});
