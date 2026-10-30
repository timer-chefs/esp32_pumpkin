import { useSdCard } from "../sd_card/sd_card_slice.ts";
import type { Preset } from "./presets.ts";

/**
 * Whether a preset's sound isn't on the SD card. Nothing is missing until
 * the card has been listed.
 */
export function useIsSoundMissing(): (preset: Preset) => boolean {
  const { files } = useSdCard();

  // The card's file system ignores case, so a preset finds its sound however
  // the file happens to be spelled.
  const filesOnCard =
    files && new Set(files.map((file) => file.name.toLowerCase()));

  return (preset) =>
    preset.sound !== null &&
    filesOnCard !== null &&
    !filesOnCard.has(preset.sound.toLowerCase());
}
