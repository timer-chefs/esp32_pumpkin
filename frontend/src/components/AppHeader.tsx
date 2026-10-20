import { useAppStatus } from "../app/status_slice.ts";
import { WakeLockIndicator } from "./WakeLockIndicator.tsx";

export function AppHeader() {
  const { mode, streaming } = useAppStatus();

  return (
    <header className="app-header">
      <div>
        <h1 className="app-brand m-0">
          <svg
            className="app-brand-emblem"
            viewBox="0 0 40 40"
            width="40"
            height="40"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M19 12c-1-5 1-8 6-9l2 3c-4 1-6 3-5 6Z"
              fill="currentColor"
            />
            <path
              d="M20 12C9 6 2 15 3 25c1 11 10 14 17 10 7 4 16 1 17-10 1-10-6-19-17-13Z"
              fill="currentColor"
            />
            <path
              d="m9 18 8 6H8Zm22 0 1 6h-9ZM18 27l2-4 2 4ZM8 28l7 3 2-3 3 4 3-4 2 3 7-3-5 7H13Z"
              fill="var(--pumpkin-ink)"
            />
          </svg>
          <span className="app-brand-label">Pumpkin</span>
        </h1>
      </div>
      <div className="app-status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span className="app-status-mode">
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
