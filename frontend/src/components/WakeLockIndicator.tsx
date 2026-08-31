import { Eye, EyeOff } from "lucide-react";

import { useKeepScreenAwake, type WakeLockStatus } from "../wake_lock.ts";

const LABELS: Record<WakeLockStatus, string> = {
  active: "Screen will stay awake",
  inactive: "Screen may sleep",
  unsupported: "Screen may sleep (not supported by this browser)",
};

export function WakeLockIndicator() {
  const status = useKeepScreenAwake();
  const Icon = status === "active" ? Eye : EyeOff;

  return (
    <span
      className={`wake-lock-indicator wake-lock-indicator--${status}`}
      title={LABELS[status]}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="visually-hidden">{LABELS[status]}</span>
    </span>
  );
}
