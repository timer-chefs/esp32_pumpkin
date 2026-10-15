import {
  CloudLightning,
  Flame,
  Ghost,
  type LucideIcon,
  Moon,
  Skull,
  WandSparkles,
} from "lucide-react";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import type { PresetScene } from "../../pumpkin_client.ts";

/**
 * The icons a preset can show. A preset names its icon rather than holding
 * the component, so it stays plain data that can be stored once presets are
 * editable.
 */
export const presetIcons = {
  flame: Flame,
  ghost: Ghost,
  lightning: CloudLightning,
  moon: Moon,
  skull: Skull,
  wand: WandSparkles,
} satisfies Record<string, LucideIcon>;

export type PresetIcon = keyof typeof presetIcons;

export interface Preset extends PresetScene {
  id: string;
  name: string;
  icon: PresetIcon;
}

export const defaultPresets: Preset[] = [
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
    icon: "lightning",
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
    icon: "wand",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#33ff33" },
    sound: "witch.wav",
    eye: EyeEffectId.SHIFTY,
  },
];
