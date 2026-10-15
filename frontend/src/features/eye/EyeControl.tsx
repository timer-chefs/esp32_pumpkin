import { Eye, EyeClosed } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "react-bootstrap";

import "./eye.css";
import { EYE_REACH, LID_OPEN, useEye } from "./eye_slice.ts";

export function EyeControl() {
  const { position, lid, look, moveLid } = useEye();
  const isOpen = lid > 0;

  // The direction thumb draws the eye as the device should be holding it.
  const eyeStyle = {
    "--look": position / EYE_REACH,
    "--shut": 1 - lid / LID_OPEN,
  } as CSSProperties;

  return (
    <section className="control-section" aria-labelledby="eye-heading">
      <div className="section-heading">
        <h2 id="eye-heading">Eye</h2>
        <span className="text-body-secondary">Drag to look around</span>
      </div>

      <div className="eye-panel">
        <div className="eye-look">
          <input
            type="range"
            className="eye-slider eye-look-slider"
            style={eyeStyle}
            aria-label="Eye direction"
            aria-valuetext={describeDirection(position)}
            min={-EYE_REACH}
            max={EYE_REACH}
            step={1}
            value={position}
            onChange={(event) => look(event.currentTarget.valueAsNumber)}
          />
          <div className="eye-look-scale" aria-hidden="true">
            <span>Left</span>
            <span>Ahead</span>
            <span>Right</span>
          </div>
        </div>

        <Button
          variant="outline-dark"
          className="icon-label-button eye-lid-button p-0"
          aria-label={isOpen ? "Close eye" : "Open eye"}
          title={isOpen ? "Close eye" : "Open eye"}
          onClick={() => moveLid(isOpen ? 0 : LID_OPEN)}
        >
          {isOpen ? (
            <EyeClosed aria-hidden="true" />
          ) : (
            <Eye aria-hidden="true" />
          )}
        </Button>
      </div>
    </section>
  );
}

function describeDirection(position: number): string {
  if (position === 0) {
    return "Straight ahead";
  }

  const percentage = Math.round((Math.abs(position) / EYE_REACH) * 100);
  return `${percentage}% ${position < 0 ? "left" : "right"}`;
}
