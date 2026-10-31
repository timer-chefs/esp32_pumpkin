import { EyeEffectId, LightEffectId } from "../generated/pumpkin/protocol.ts";
import type { Preset } from "../features/presets/presets.ts";

/** Presets for the tests, more of them than fit on the page. */
export const testPresets: Preset[] = [
  {
    id: "ghost",
    name: "Ghost",
    icon: "ghost",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#8000ff" },
    sound: "ghost.wav",
    eye: EyeEffectId.WANDER,
  },
  {
    id: "scream",
    name: "Scream",
    icon: "skull",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ff0000" },
    sound: "scream.wav",
    eye: EyeEffectId.STARE,
  },
  {
    id: "wolf",
    name: "Wolf",
    icon: "moon",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#3366ff" },
    sound: "wolf.wav",
    eye: EyeEffectId.WANDER,
  },
  {
    id: "thunder",
    name: "Thunder",
    icon: "cloud-lightning",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ffffff" },
    sound: "thunder.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "candles",
    name: "Candles",
    icon: "flame",
    light: { effect: LightEffectId.CANDLE, color: "#ffa500" },
    sound: null,
    eye: EyeEffectId.SLEEP,
  },
  {
    id: "witch",
    name: "Witch",
    icon: "wand-sparkles",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#33ff33" },
    sound: "witch.wav",
    eye: EyeEffectId.SHIFTY,
  },
];
