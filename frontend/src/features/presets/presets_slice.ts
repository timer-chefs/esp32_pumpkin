import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";
import { toError } from "../../to_error.ts";
import { defaultPresets, type Preset } from "./presets.ts";

export interface PresetsState {
  /** Fixed for now, but held here so that editing them later is a matter of updating it. */
  presets: Preset[];
  error: string | null;
}

export interface PresetsActions {
  play: (id: string) => void;
}

export const presetsSlice: Slice<PresetsState, PresetsActions> = {
  initialState: { presets: defaultPresets, error: null },
  createActions: ({ getState, update, app }) => ({
    play: (id) =>
      runAction(async () => {
        const preset = getState().presets.find((preset) => preset.id === id);
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
