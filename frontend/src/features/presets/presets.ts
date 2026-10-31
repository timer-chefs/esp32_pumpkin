import {
  CloudLightning,
  EyeDashed,
  FaceGrinning,
  FaceSlightlySmilingPlus,
  Flame,
  FlaskConical,
  Ghost,
  type LucideIcon,
  Moon,
  Music,
  Skull,
  Square,
  Wand,
  WandSparkles,
} from "lucide-react";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import type { PresetScene } from "../../pumpkin_client.ts";

/**
 * The icons the page carries itself, so the presets can show these without
 * the rest. A preset names its icon as Lucide does, which is how these are
 * keyed.
 */
export const presetIcons = {
  "cloud-lightning": CloudLightning,
  "eye-dashed": EyeDashed,
  "face-grinning": FaceGrinning,
  "face-slightly-smiling-plus": FaceSlightlySmilingPlus,
  flame: Flame,
  "flask-conical": FlaskConical,
  ghost: Ghost,
  moon: Moon,
  music: Music,
  skull: Skull,
  square: Square,
  wand: Wand,
  "wand-sparkles": WandSparkles,
} satisfies Record<string, LucideIcon>;

export type PresetIcon = keyof typeof presetIcons;

export function isBuiltInIcon(name: string): name is PresetIcon {
  return Object.hasOwn(presetIcons, name);
}

export interface Preset extends PresetScene {
  id: string;
  name: string;
  /** The name of one of Lucide's icons. */
  icon: string;
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

/** Whether two presets look and play the same. */
export function isSamePreset(preset: Preset, other: Preset): boolean {
  return (
    preset.name === other.name &&
    preset.icon === other.icon &&
    preset.light?.effect === other.light?.effect &&
    preset.light?.color === other.light?.color &&
    preset.sound === other.sound &&
    preset.eye === other.eye
  );
}

/** What editing has done to a preset, against the presets as they're saved. */
export function changeTo(
  preset: Preset,
  saved: Preset[],
): "new" | "changed" | null {
  const before = saved.find((savedPreset) => savedPreset.id === preset.id);
  if (!before) {
    return "new";
  }

  return isSamePreset(preset, before) ? null : "changed";
}

/**
 * Whether the edited presets are any different from the saved ones: added
 * to, changed, taken away from or put in another order.
 */
export function hasChanges(edited: Preset[], saved: Preset[]): boolean {
  return (
    edited.length !== saved.length ||
    edited.some(
      (preset, index) =>
        preset.id !== saved[index].id || !isSamePreset(preset, saved[index]),
    )
  );
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
