import { useSlice } from "../../app/app_context.tsx";
import type { Slice } from "../../app/slice.ts";
import { effects } from "./effects.ts";

/** How the pumpkin's voice sounds, whether it's talking or saying something typed. */
export interface VoiceEffectState {
  effectId: string;
}

export interface VoiceEffectActions {
  select: (id: string) => void;
}

export const voiceEffectSlice: Slice<VoiceEffectState, VoiceEffectActions> = {
  initialState: { effectId: effects[0].id },
  createActions: ({ update }) => ({
    select: (id) => update({ effectId: id }),
  }),
};

export function useVoiceEffect() {
  return useSlice("voiceEffect");
}
