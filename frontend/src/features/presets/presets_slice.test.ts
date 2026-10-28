import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import { EyeEffectId } from "../../generated/pumpkin/protocol.ts";
import api from "../../pumpkin_client.ts";
import { defaultPresets } from "./presets.ts";
import { presetsSlice, type PresetsState } from "./presets_slice.ts";

vi.mock("../../pumpkin_client.ts", () => ({
  default: {
    getPresetsFile: vi.fn(),
  },
}));

/** The slice's actions over a state of its own, as the controller would set it up. */
function createPresets(initial: Partial<PresetsState> = {}) {
  let state: PresetsState = { ...presetsSlice.initialState, ...initial };
  const actions = presetsSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: {} as AppAccess,
  });

  return { actions, state: () => state };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("presetsSlice.load", () => {
  it("reads the presets the device has stored", async () => {
    vi.mocked(api.getPresetsFile).mockResolvedValue(
      "name,eye\nScream,stare\nGhost,wnder\n",
    );
    const { actions, state } = createPresets();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().presets).toMatchObject([
      { name: "Scream", eye: EyeEffectId.STARE },
      { name: "Ghost", eye: EyeEffectId.NONE },
    ]);
    expect(state().problems).toEqual([
      `Line 3: "wnder" isn't an eye effect (none, wander, shifty, stare, sleep)`,
    ]);
    expect(state().error).toBeNull();
  });

  it("starts a card that has no presets off with the built-in ones", async () => {
    vi.mocked(api.getPresetsFile).mockResolvedValue(null);
    const { actions, state } = createPresets({ problems: ["stale"] });

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().presets).toBe(defaultPresets);
    expect(state().problems).toEqual([]);
  });

  it("reports presets that couldn't be read", async () => {
    vi.mocked(api.getPresetsFile).mockRejectedValue(
      new Error("No SD card detected"),
    );
    const { actions, state } = createPresets();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().presets).toBeNull();
    expect(state().error).toBe(
      "Could not read the presets: No SD card detected",
    );
  });
});
