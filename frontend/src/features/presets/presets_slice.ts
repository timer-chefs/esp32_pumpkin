import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";
import { toError } from "../../to_error.ts";
import { defaultPresets, type Preset } from "./presets.ts";
import { parsePresetsCsv } from "./presets_csv.ts";

export interface PresetsState {
  /** What the device has stored. Null until it has said. */
  presets: Preset[] | null;
  /** What couldn't be read from the stored file, and was left at its default. */
  problems: string[];
  isLoading: boolean;
  error: string | null;
}

export interface PresetsActions {
  load: () => void;
  play: (id: string) => void;
}

export const presetsSlice: Slice<PresetsState, PresetsActions> = {
  initialState: { presets: null, problems: [], isLoading: false, error: null },
  createActions: ({ getState, update, app }) => ({
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
        if (!preset) {
          return;
        }

        update({ error: null });
        // The device plays the preset's sound on its own, so hand it back
        // from whatever the browser was streaming first.
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
      }),
  }),
};

export function usePresets() {
  return useSlice("presets");
}
