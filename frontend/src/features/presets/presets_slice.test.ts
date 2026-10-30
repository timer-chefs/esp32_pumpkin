import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import { EyeEffectId } from "../../generated/pumpkin/protocol.ts";
import api from "../../pumpkin_client.ts";
import type { PumpkinConnection } from "../../pumpkin_connection.ts";
import { defaultPresets, newPreset } from "./presets.ts";
import { presetsToCsv } from "./presets_csv.ts";
import { presetsSlice, type PresetsState } from "./presets_slice.ts";

vi.mock("../../pumpkin_client.ts", () => ({
  default: {
    getPresetsFile: vi.fn(),
    savePresetsFile: vi.fn(),
    playPreset: vi.fn(),
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

describe("presetsSlice editing", () => {
  const [ghost, scream, wolf] = defaultPresets;
  const names = (presets: readonly { name: string }[] | null) =>
    presets?.map((preset) => preset.name);

  function editing(presets = [ghost, scream, wolf]) {
    const slice = createPresets({ presets, error: "Earlier" });
    slice.actions.edit();
    return slice;
  }

  it("edits the presets as they are", () => {
    const { state } = editing();

    expect(state().draft).toEqual(state().presets);
    expect(state().error).toBeNull();
  });

  it("moves a preset up and down", () => {
    const { actions, state } = editing();

    actions.move(wolf.id, -1);
    expect(names(state().draft)).toEqual(["Ghost", "Wolf", "Scream"]);

    actions.move(ghost.id, 1);
    expect(names(state().draft)).toEqual(["Wolf", "Ghost", "Scream"]);
  });

  it("doesn't move a preset past either end", () => {
    const { actions, state } = editing();

    actions.move(ghost.id, -1);
    actions.move(wolf.id, 1);

    expect(names(state().draft)).toEqual(["Ghost", "Scream", "Wolf"]);
  });

  it("adds a preset after the others", () => {
    const { actions, state } = editing();

    actions.add(newPreset());

    expect(names(state().draft)).toEqual([
      "Ghost",
      "Scream",
      "Wolf",
      "New preset",
    ]);
  });

  it("changes one preset and leaves the others be", () => {
    const { actions, state } = editing();

    actions.change(scream.id, { name: "Shriek", sound: null });

    expect(state().draft).toEqual([
      ghost,
      { ...scream, name: "Shriek", sound: null },
      wolf,
    ]);
    expect(state().presets).toEqual([ghost, scream, wolf]);
  });

  it("tries out a preset as it has been edited so far", async () => {
    const connection = {} as PumpkinConnection;
    const stopStreaming = vi.fn().mockResolvedValue(undefined);
    const setStatus = vi.fn();
    vi.mocked(api.playPreset).mockResolvedValue();
    let state: PresetsState = {
      ...presetsSlice.initialState,
      presets: [ghost],
      draft: [{ ...ghost, sound: "boo.wav" }],
    };
    const actions = presetsSlice.createActions({
      getState: () => state,
      update: (partial) => {
        state = { ...state, ...partial };
      },
      app: {
        connection: async () => connection,
        actions: () => ({
          audioSource: { stopStreaming },
          status: { set: setStatus },
        }),
      } as unknown as AppAccess,
    });

    actions.tryOut(ghost.id);

    await vi.waitFor(() => expect(setStatus).toHaveBeenCalled());
    expect(stopStreaming).toHaveBeenCalledOnce();
    expect(api.playPreset).toHaveBeenCalledExactlyOnceWith(
      connection,
      expect.objectContaining({ sound: "boo.wav" }),
    );
  });

  it("takes a preset away", () => {
    const { actions, state } = editing();

    actions.remove(scream.id);

    expect(names(state().draft)).toEqual(["Ghost", "Wolf"]);
  });

  it("leaves the presets as they were when cancelled", () => {
    const { actions, state } = editing();

    actions.remove(scream.id);
    actions.cancelEditing();

    expect(state().draft).toBeNull();
    expect(names(state().presets)).toEqual(["Ghost", "Scream", "Wolf"]);
    expect(api.savePresetsFile).not.toHaveBeenCalled();
  });

  it("saves the edited presets to the card", async () => {
    vi.mocked(api.savePresetsFile).mockResolvedValue();
    const { actions, state } = editing();

    actions.remove(scream.id);
    actions.finishEditing();

    expect(state().isSaving).toBe(true);
    await vi.waitFor(() => expect(state().isSaving).toBe(false));
    expect(api.savePresetsFile).toHaveBeenCalledExactlyOnceWith(
      presetsToCsv([ghost, wolf]),
    );
    expect(state().draft).toBeNull();
    expect(names(state().presets)).toEqual(["Ghost", "Wolf"]);
  });

  it("saves unchanged presets, which a card without a file needs", async () => {
    vi.mocked(api.savePresetsFile).mockResolvedValue();
    const { actions, state } = createPresets({
      presets: defaultPresets,
      problems: ["Line 2: there's no name"],
    });

    actions.edit();
    actions.finishEditing();

    await vi.waitFor(() => expect(state().draft).toBeNull());
    expect(api.savePresetsFile).toHaveBeenCalledExactlyOnceWith(
      presetsToCsv(defaultPresets),
    );
    // What was saved is all there is now, and every bit of it reads.
    expect(state().problems).toEqual([]);
  });

  it("won't save a preset without a name", () => {
    const { actions, state } = editing();

    actions.change(scream.id, { name: "  " });
    actions.finishEditing();

    expect(state().error).toBe("Preset 2 needs a name");
    expect(state().draft).not.toBeNull();
    expect(api.savePresetsFile).not.toHaveBeenCalled();
  });

  it("saves names without the spaces around them", async () => {
    vi.mocked(api.savePresetsFile).mockResolvedValue();
    const { actions, state } = editing([ghost]);

    actions.change(ghost.id, { name: " Boo " });
    actions.finishEditing();

    await vi.waitFor(() => expect(state().draft).toBeNull());
    expect(names(state().presets)).toEqual(["Boo"]);
  });

  it("keeps the edits when they couldn't be saved", async () => {
    vi.mocked(api.savePresetsFile).mockRejectedValue(
      new Error("No SD card detected"),
    );
    const { actions, state } = editing();

    actions.remove(scream.id);
    actions.finishEditing();

    await vi.waitFor(() => expect(state().isSaving).toBe(false));
    expect(state().error).toBe(
      "Could not save the presets: No SD card detected",
    );
    expect(names(state().draft)).toEqual(["Ghost", "Wolf"]);
    expect(names(state().presets)).toEqual(["Ghost", "Scream", "Wolf"]);
  });
});
