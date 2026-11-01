import { Save, Settings, Shuffle, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Alert, Button, Form, InputGroup, Modal } from "react-bootstrap";

import type { PauseRange } from "../../pumpkin_client.ts";
import "./auto_mode.css";
import { maxPauseS, useAutoMode } from "./auto_mode_slice.ts";

/**
 * Leaves the pumpkin to play presets at random by itself, which it carries
 * on doing with the page closed.
 */
export function AutoModeControl() {
  const { isRunning, pause, error, start, stop, setPause } = useAutoMode();
  const [isEditing, setIsEditing] = useState(false);

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
        <Button
          variant="dark"
          className="auto-mode-settings"
          aria-label={`Auto mode settings: pause ${describePause(pause)}`}
          onClick={() => setIsEditing(true)}
        >
          <Settings aria-hidden="true" />
          {describePause(pause)}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}

      <Modal
        show={isEditing}
        onHide={() => setIsEditing(false)}
        animation={false}
        contentClassName="app-modal"
        aria-labelledby="auto-mode-settings-heading"
      >
        {/* Only there while open, so that it starts from the pause in use. */}
        <PauseSettings
          pause={pause}
          onSave={(pause) => {
            setPause(pause);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </Modal>
    </section>
  );
}

interface PauseSettingsProps {
  pause: PauseRange;
  onSave: (pause: PauseRange) => void;
  onCancel: () => void;
}

function PauseSettings({ pause, onSave, onCancel }: PauseSettingsProps) {
  // As typed, so that a field can be emptied on the way to another number.
  const [min, setMin] = useState(String(pause.minS));
  const [max, setMax] = useState(String(pause.maxS));
  // Problems are pointed out from the first try at saving on.
  const [hasTriedSaving, setHasTriedSaving] = useState(false);

  const minS = readSeconds(min);
  const maxS = readSeconds(max);
  const isOutOfOrder = minS !== null && maxS !== null && minS > maxS;
  const problem =
    minS === null || maxS === null
      ? `Pauses are whole seconds, from 0 to ${maxPauseS}`
      : isOutOfOrder
        ? "The shortest pause can't be longer than the longest"
        : null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setHasTriedSaving(true);
    if (minS !== null && maxS !== null && !isOutOfOrder) {
      onSave({ minS, maxS });
    }
  };

  const isMinInvalid = hasTriedSaving && (minS === null || isOutOfOrder);
  const isMaxInvalid = hasTriedSaving && (maxS === null || isOutOfOrder);

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title as="h2" id="auto-mode-settings-heading">
          Auto mode
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form id="auto-mode-settings" noValidate onSubmit={save}>
          <p>
            After each preset, auto mode pauses for a random number of seconds
            between these.
          </p>
          <div className="auto-mode-pause-fields">
            <Form.Group controlId="auto-mode-min-pause">
              <Form.Label>Shortest pause</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maxPauseS}
                  step={1}
                  value={min}
                  isInvalid={isMinInvalid}
                  onChange={(event) => setMin(event.target.value)}
                />
                <InputGroup.Text>s</InputGroup.Text>
              </InputGroup>
            </Form.Group>
            <Form.Group controlId="auto-mode-max-pause">
              <Form.Label>Longest pause</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maxPauseS}
                  step={1}
                  value={max}
                  isInvalid={isMaxInvalid}
                  onChange={(event) => setMax(event.target.value)}
                />
                <InputGroup.Text>s</InputGroup.Text>
              </InputGroup>
            </Form.Group>
          </div>
          {hasTriedSaving && problem && (
            <Form.Text className="text-danger" aria-live="polite">
              {problem}
            </Form.Text>
          )}
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="outline-dark"
          className="icon-label-button"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
          Cancel
        </Button>
        <Button
          type="submit"
          form="auto-mode-settings"
          variant="dark"
          className="icon-label-button"
        >
          <Save aria-hidden="true" />
          Save
        </Button>
      </Modal.Footer>
    </>
  );
}

/** A whole number of seconds the device can pause for, or null. */
function readSeconds(text: string): number | null {
  const seconds = Number(text);
  return /^\d+$/.test(text.trim()) && seconds <= maxPauseS ? seconds : null;
}

/** Like "15–45 s", or "1–3 min" when both are whole minutes. */
function describePause({ minS, maxS }: PauseRange): string {
  const [divisor, unit] =
    maxS > 0 && minS % 60 === 0 && maxS % 60 === 0 ? [60, "min"] : [1, "s"];
  const [min, max] = [minS / divisor, maxS / divisor];
  return min === max ? `${max} ${unit}` : `${min}–${max} ${unit}`;
}
