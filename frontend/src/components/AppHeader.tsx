import { useAppContext } from "../app_context.tsx";

export function AppHeader() {
  const { currentMode, currentStreaming } = useAppContext().state;

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
          <strong>{currentMode}</strong>
        </span>
        {currentStreaming && (
          <span className="streaming-label text-truncate">
            {currentStreaming}
          </span>
        )}
      </div>
    </header>
  );
}
