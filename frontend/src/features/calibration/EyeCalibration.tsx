import { Minus, Plus, RefreshCw, RotateCcw, Save } from "lucide-react";
import { useEffect } from "react";
import { Alert, Button, ButtonGroup, Spinner } from "react-bootstrap";

import type { EyeServo, ServoRangeInfo } from "../../pumpkin_client.ts";
import {
  SERVO_MAX_ANGLE,
  type ServoEnd,
  servoTitles,
  useCalibration,
} from "./calibration_slice.ts";
import "./calibration.css";

/** What each servo does, and where each end of its range leaves the eye. */
const servoDetails: Record<
  EyeServo,
  { hint: string; ends: Record<ServoEnd, string> }
> = {
  ball: {
    hint: "Turns from side to side",
    ends: { min: "Far left", max: "Far right" },
  },
  lid: {
    hint: "Opens and closes",
    ends: { min: "Shut", max: "Wide open" },
  },
};

const servos: EyeServo[] = ["ball", "lid"];
const ends: ServoEnd[] = ["min", "max"];

export function EyeCalibration() {
  const { saved, draft, isLoading, error, load } = useCalibration();

  useEffect(() => {
    if (draft === null && !isLoading) {
      load();
    }
  }, []);

  return (
    <>
      {saved && draft ? (
        servos.map((servo) => (
          <ServoCalibration
            key={servo}
            servo={servo}
            range={draft[servo]}
            savedRange={saved[servo]}
          />
        ))
      ) : (
        <section className="control-section" aria-label="Calibration">
          <p className="empty-state mb-0">
            {isLoading ? (
              <Spinner
                animation="border"
                size="sm"
                aria-label="Reading the calibration"
              />
            ) : (
              <Button
                variant="outline-dark"
                className="icon-label-button"
                onClick={load}
              >
                <RefreshCw aria-hidden="true" />
                Read the calibration
              </Button>
            )}
          </p>
        </section>
      )}

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}
    </>
  );
}

interface ServoCalibrationProps {
  servo: EyeServo;
  range: ServoRangeInfo;
  savedRange: ServoRangeInfo;
}

function ServoCalibration({ servo, range, savedRange }: ServoCalibrationProps) {
  const { saving, setAngle, preview, save, revert } = useCalibration();
  const title = servoTitles[servo];
  const { hint, ends: endNames } = servoDetails[servo];
  const isSaved = range.min === savedRange.min && range.max === savedRange.max;

  return (
    <section
      className="control-section"
      aria-labelledby={`${servo}-calibration-heading`}
    >
      <div className="section-heading">
        <h2 id={`${servo}-calibration-heading`}>{title}</h2>
        <span className="text-body-secondary">{hint}</span>
      </div>

      <div className="calibration-panel">
        {ends.map((end) => (
          <AngleControl
            key={end}
            id={`${servo}-${end}-angle`}
            label={`${title} ${end}`}
            end={end}
            description={endNames[end]}
            angle={range[end]}
            onChange={(angle) => setAngle(servo, end, angle)}
            onPreview={() => preview(servo, end)}
          />
        ))}

        <div className="calibration-actions">
          <span className="text-body-secondary">
            {isSaved ? "In use on the pumpkin" : "Not saved yet"}
          </span>
          <Button
            variant="outline-dark"
            className="icon-label-button"
            disabled={isSaved}
            onClick={() => revert(servo)}
          >
            <RotateCcw aria-hidden="true" />
            Revert
          </Button>
          <Button
            variant="warning"
            className="icon-label-button"
            disabled={isSaved || saving !== null}
            onClick={() => save(servo)}
          >
            {saving === servo ? (
              <Spinner animation="border" size="sm" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

interface AngleControlProps {
  id: string;
  /** What the slider is called, e.g. "Eye min". */
  label: string;
  end: ServoEnd;
  /** Where this end leaves the eye. */
  description: string;
  angle: number;
  onChange: (angle: number) => void;
  /** Moves the servo to this end, without changing it. */
  onPreview: () => void;
}

function AngleControl({
  id,
  label,
  end,
  description,
  angle,
  onChange,
  onPreview,
}: AngleControlProps) {
  return (
    <div className="calibration-end">
      <div className="calibration-end-heading">
        <label htmlFor={id} className="calibration-end-label">
          <strong>{end === "min" ? "Min" : "Max"}</strong>
          <span className="text-body-secondary">{description}</span>
        </label>
        <ButtonGroup aria-label={`Fine-tune ${label}`}>
          <Button
            variant="outline-dark"
            className="icon-button"
            aria-label={`Decrease ${label}`}
            title="One degree less"
            disabled={angle <= 0}
            onClick={() => onChange(angle - 1)}
          >
            <Minus aria-hidden="true" />
          </Button>
          <output className="calibration-readout" htmlFor={id}>
            {angle}°
          </output>
          <Button
            variant="outline-dark"
            className="icon-button"
            aria-label={`Increase ${label}`}
            title="One degree more"
            disabled={angle >= SERVO_MAX_ANGLE}
            onClick={() => onChange(angle + 1)}
          >
            <Plus aria-hidden="true" />
          </Button>
        </ButtonGroup>
      </div>

      {/* Taking hold of a slider shows where its end is before it moves. */}
      <input
        id={id}
        type="range"
        className="calibration-slider"
        aria-label={label}
        aria-valuetext={`${angle}°`}
        min={0}
        max={SERVO_MAX_ANGLE}
        step={1}
        value={angle}
        onFocus={onPreview}
        onPointerDown={onPreview}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  );
}
