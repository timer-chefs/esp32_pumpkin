import { useAppStatus } from "../app/status_slice.ts";
import { WakeLockIndicator } from "./WakeLockIndicator.tsx";

export function AppHeader() {
  const { mode, streaming } = useAppStatus();

  return (
    <header className="app-header">
      <div>
        <p className="app-kicker mb-1">ESP32 controller</p>
        <h1 className="mb-0">Pumpkin</h1>
      </div>
      <div className="app-status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span>
          <small>Mode</small>
          <strong>{mode}</strong>
        </span>
        <WakeLockIndicator />
        {streaming && (
          <span className="streaming-label text-truncate">{streaming}</span>
        )}
      </div>
    </header>
  );
}
