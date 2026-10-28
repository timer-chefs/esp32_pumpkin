import {
  CloudLightning,
  Flame,
  Ghost,
  EyeDashed,
  Music,
  FlaskConical,
  FaceGrinning,
  FaceSlightlySmilingPlus,
  type LucideIcon,
  Moon,
  Skull,
  WandSparkles,
  Wand,
  Square,
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
  eyedashed: EyeDashed,
  music: Music,
  flask: FlaskConical,
  face_grinning: FaceGrinning,
  face_slightly_smiling_plus: FaceSlightlySmilingPlus,
  lightning: CloudLightning,
  moon: Moon,
  skull: Skull,
  wand_sparkles: WandSparkles,
  wand: Wand,
  square: Square,
} satisfies Record<string, LucideIcon>;

export type PresetIcon = keyof typeof presetIcons;

export interface Preset extends PresetScene {
  id: string;
  name: string;
  icon: PresetIcon;
}

let lastPresetId = 0;

/**
 * Tells presets apart while they're shown and edited. Not stored: where a
 * preset is in the list is all that identifies it on the device. A counter
 * rather than crypto.randomUUID(), which only a secure context has.
 */
export function newPresetId(): string {
  lastPresetId += 1;
  return `preset-${lastPresetId}`;
}

/** What a preset added in the editor starts off as. */
export function newPreset(): Preset {
  return {
    id: newPresetId(),
    name: "New preset",
    icon: "ghost",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ff8800" },
    sound: null,
    eye: EyeEffectId.NONE,
  };
}

export const defaultPresets: Preset[] = [
  {
    id: "ghost",
    name: "Ghost",
    icon: "ghost",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ffffff" },
    sound: "ghost.wav",
    eye: EyeEffectId.WANDER,
  },
  {
    id: "evil_laugh",
    name: "Evil laugh",
    icon: "face_grinning",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#8000ff" },
    sound: "evil_laugh.wav",
    eye: EyeEffectId.WANDER,
  },
  {
    id: "scream",
    name: "Scream",
    icon: "skull",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF5C00" },
    sound: "scream.wav", //something happnes here
    eye: EyeEffectId.STARE,
  },
  {
    id: "breath",
    name: "Breath",
    icon: "flask",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ff0000" },
    sound: "breath.wav",
    eye: EyeEffectId.STARE,
  },
  {
    id: "gotcha",
    name: "Gotcha",
    icon: "face_slightly_smiling_plus",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ffffff" },
    sound: "gotcha.wav",
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
    id: "witch",
    name: "Witch",
    icon: "wand_sparkles",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#00FF33" },
    sound: "witch.wav",
    eye: EyeEffectId.SHIFTY,
  },
  {
    id: "a_good_look",
    name: "A good look",
    icon: "eyedashed",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#3344ff" },
    sound: "a_good_look.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "adams_family",
    name: "Adams Family",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#3344ff" },
    sound: "adams_family.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "cant_touch_this",
    name: "Can´t touch this",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF5C00" },
    sound: "cant_touch_this.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "ghostbusters",
    name: "Gostbusters",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#00FF33" },
    sound: "ghostbusters.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "grim_grinning_ghosts",
    name: "Grim Grinning Ghosts",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#4c00ff" },
    sound: "grim_grinning_ghosts.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "harry_potter",
    name: "Harry Potter",
    icon: "wand",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FFD700" },
    sound: "harry_potter.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "monster_mash",
    name: "Monster Mash",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#00FF33" },
    sound: "monster_mash.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "mountain_king",
    name: "Mountain King",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF1493" },
    sound: "mountain_king.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "spooky_scary_skeletons",
    name: "Spooky Scary Skeletons",
    icon: "skull",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ffffff" },
    sound: "spooky_scary_skeletons.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "stranger_things",
    name: "Stranger Things",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ff0000" },
    sound: "stranger_things.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "this_is_halloween",
    name: "This Is Halloween",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF5C00" },
    sound: "this_is_halloween.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "thriler",
    name: "Thriler",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF1493" },
    sound: "thriler.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "time_warp-part1",
    name: "Time Warp Part 1",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF1493" },
    sound: "time_warp-part1.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "time_warp-part2",
    name: "Time Warp Part 2",
    icon: "music",
    light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#FF1493" },
    sound: "time_warp-part2.wav",
    eye: EyeEffectId.NONE,
  },
  {
    id: "cancel show",
    name: "Cancel Show",
    icon: "square",
    light: { effect: LightEffectId.CANDLE, color: "#ff0000" },
    sound: null,
    eye: EyeEffectId.SLEEP,
  },
];
