import { CircleQuestionMark } from "lucide-react";

import { isBuiltInIcon, presetIcons } from "./presets.ts";

/** A preset's icon. One the page can't show is a question mark. */
export function PresetIconImage({ name }: { name: string }) {
  const Icon = isBuiltInIcon(name) ? presetIcons[name] : CircleQuestionMark;
  return <Icon aria-hidden="true" />;
}
