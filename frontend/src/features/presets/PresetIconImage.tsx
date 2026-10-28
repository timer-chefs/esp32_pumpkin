import { CircleQuestionMark, Icon } from "lucide-react";

import { useIconSet } from "./icon_set_slice.ts";
import { isBuiltInIcon, presetIcons } from "./presets.ts";

/**
 * A preset's icon: one the page carries, or else one from the SD card's
 * file of them all. One it can't find there either is a question mark.
 */
export function PresetIconImage({ name }: { name: string }) {
  const { icons } = useIconSet();

  if (isBuiltInIcon(name)) {
    const BuiltInIcon = presetIcons[name];
    return <BuiltInIcon aria-hidden="true" />;
  }

  const iconNode = icons?.get(name);
  return iconNode ? (
    <Icon iconNode={iconNode} className={`lucide-${name}`} aria-hidden="true" />
  ) : (
    <CircleQuestionMark aria-hidden="true" />
  );
}
