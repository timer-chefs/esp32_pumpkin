import { Shuffle } from "lucide-react";
import { Alert, Button, Form } from "react-bootstrap";

import "./auto_mode.css";
import { pauses, useAutoMode } from "./auto_mode_slice.ts";

/**
 * Leaves the pumpkin to play presets at random by itself, which it carries
 * on doing with the page closed.
 */
export function AutoModeControl() {
  const { isRunning, pauseId, error, start, stop, setPause } = useAutoMode();

  return (
    <section className="control-section">
      <div className="auto-mode-controls">
        <Button
          variant={isRunning ? "warning" : "dark"}
          className="auto-mode-toggle"
          aria-pressed={isRunning === true}
          onClick={isRunning ? stop : start}
        >
          <Shuffle aria-hidden="true" />
          Auto mode
        </Button>
        <Form.Select
          className="auto-mode-pause"
          aria-label="Pause between presets"
          value={pauseId}
          onChange={(event) => setPause(event.currentTarget.value)}
        >
          {pauses.map((pause) => (
            <option key={pause.id} value={pause.id}>
              {pause.name}
            </option>
          ))}
        </Form.Select>
      </div>

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}
    </section>
  );
}
