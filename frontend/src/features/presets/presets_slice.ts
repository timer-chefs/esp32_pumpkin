import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";
import { toError } from "../../to_error.ts";
import { defaultPresets, type Preset } from "./presets.ts";
import { parsePresetsCsv, presetsToCsv } from "./presets_csv.ts";

export interface PresetsState {
  /** What the device has stored. Null until it has said. */
  presets: Preset[] | null;
  /**
   * The presets being edited, which take the place of `presets` once they're
   * saved. Null while they aren't being edited.
   */
  draft: Preset[] | null;
  /** What couldn't be read from the stored file, and was left at its default. */
  problems: string[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export type PresetChanges = Partial<Omit<Preset, "id">>;

export interface PresetsActions {
  load: () => void;
  play: (id: string) => void;
  edit: () => void;
  /** Adds a preset after the ones being edited. */
  add: (preset: Preset) => void;
  change: (id: string, changes: PresetChanges) => void;
  /** Plays a preset being edited, as it is so far. */
  tryOut: (id: string) => void;
  /** Moves a preset being edited one place earlier (-1) or later (1). */
  move: (id: string, by: -1 | 1) => void;
  remove: (id: string) => void;
  /** Saves the presets being edited to the card, and stops editing them. */
  finishEditing: () => void;
  /** Stops editing, leaving the presets as they were. */
  cancelEditing: () => void;
}

export const presetsSlice: Slice<PresetsState, PresetsActions> = {
  initialState: {
    presets: null,
    draft: null,
    problems: [],
    isLoading: false,
    isSaving: false,
    error: null,
  },
  createActions: ({ getState, update, app }) => {
    const playPreset = async (preset: Preset): Promise<void> => {
      update({ error: null });
      // The device plays the preset's sound on its own, so hand it back from
      // whatever the browser was streaming first.
      await app.actions().audioSource.stopStreaming();

      try {
        await api.playPreset(await app.connection(), preset);
        app.actions().status.set({ mode: "Preset", streaming: preset.name });
      } catch (error) {
        console.error(`Could not play the "${preset.name}" preset:`, error);
        update({
          error: `Could not play ${preset.name}: ${toError(error).message}`,
        });
      }
    };

    const updateDraft = (change: (draft: Preset[]) => Preset[]) => {
      const { draft } = getState();
      if (draft) {
        update({ draft: change(draft) });
      }
    };

    return {
      load: () =>
        runAction(async () => {
          update({ isLoading: true, error: null });
          try {
            const csv = await api.getPresetsFile();
            // A card that has never had presets saved to it starts off with
            // these.
            update(
              csv === null
                ? { presets: defaultPresets, problems: [] }
                : parsePresetsCsv(csv),
            );
          } catch (error) {
            console.error("Could not read the presets:", error);
            update({
              error: `Could not read the presets: ${toError(error).message}`,
            });
          } finally {
            update({ isLoading: false });
          }
        }),

      play: (id) =>
        runAction(async () => {
          const preset = getState().presets?.find((preset) => preset.id === id);
          if (preset) {
            await playPreset(preset);
          }
        }),

      edit: () => {
        const { presets } = getState();
        if (presets) {
          update({ draft: presets, error: null });
        }
      },

      add: (preset) => updateDraft((draft) => [...draft, preset]),

      change: (id, changes) =>
        updateDraft((draft) =>
          draft.map((preset) =>
            preset.id === id ? { ...preset, ...changes } : preset,
          ),
        ),

      tryOut: (id) =>
        runAction(async () => {
          const preset = getState().draft?.find((preset) => preset.id === id);
          if (preset) {
            await playPreset(preset);
          }
        }),

      move: (id, by) => {
        const { draft } = getState();
        const from = draft?.findIndex((preset) => preset.id === id) ?? -1;
        const to = from + by;
        if (!draft || from < 0 || to < 0 || to >= draft.length) {
          return;
        }

        const moved = [...draft];
        [moved[from], moved[to]] = [moved[to], moved[from]];
        update({ draft: moved });
      },

      remove: (id) =>
        updateDraft((draft) => draft.filter((preset) => preset.id !== id)),

      finishEditing: () =>
        runAction(async () => {
          const { draft, isSaving } = getState();
          if (!draft || isSaving) {
            return;
          }

          const unnamed = draft.findIndex(
            (preset) => preset.name.trim() === "",
          );
          if (unnamed >= 0) {
            update({ error: `Preset ${unnamed + 1} needs a name` });
            return;
          }

          const presets = draft.map((preset) => ({
            ...preset,
            name: preset.name.trim(),
          }));

          // Sent even when nothing was changed here: the device leaves the card
          // alone if the file is the same, and otherwise this is what writes a
          // card's first presets, or replaces a file that couldn't all be read.
          update({ isSaving: true, error: null });
          try {
            await api.savePresetsFile(presetsToCsv(presets));
            update({ presets, draft: null, problems: [] });
          } catch (error) {
            console.error("Could not save the presets:", error);
            update({
              error: `Could not save the presets: ${toError(error).message}`,
            });
          } finally {
            update({ isSaving: false });
          }
        }),

      cancelEditing: () => update({ draft: null, error: null }),
    };
  },
};

export function usePresets() {
  return useSlice("presets");
}
