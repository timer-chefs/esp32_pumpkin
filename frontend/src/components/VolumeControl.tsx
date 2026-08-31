import { Minus, Plus } from "lucide-react";
import { Button, ButtonGroup, Spinner } from "react-bootstrap";

import { useAppContext } from "../app_context.tsx";

export function VolumeControl() {
  const { state, actions } = useAppContext();
  const volumePercentage =
    state.volume === null ? null : Math.round(state.volume * 100);

  return (
    <section className="utility-section" aria-labelledby="volume-heading">
      <div className="section-heading">
        <h2 id="volume-heading">Volume</h2>
      </div>
      <ButtonGroup aria-label="Output volume controls">
        <Button
          variant="outline-dark"
          className="icon-button"
          aria-label="Decrease volume"
          title="Decrease volume"
          onClick={actions.decreaseVolume}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          className="volume-readout"
          aria-busy={volumePercentage === null}
          aria-label={
            volumePercentage === null
              ? "Volume loading"
              : `Volume ${volumePercentage}%`
          }
        >
          <strong>{volumePercentage ?? <Spinner role="status" />}</strong>
          {volumePercentage !== null && <small>%</small>}
        </output>
        <Button
          variant="outline-dark"
          className="icon-button"
          aria-label="Increase volume"
          title="Increase volume"
          onClick={actions.increaseVolume}
        >
          <Plus aria-hidden="true" />
        </Button>
      </ButtonGroup>
    </section>
  );
}
