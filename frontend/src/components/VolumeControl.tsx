import { Minus, Plus } from "lucide-react";
import { Button, ButtonGroup } from "react-bootstrap";

import { useAppContext } from "../app_context.tsx";

export function VolumeControl() {
  const { state, actions } = useAppContext();

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
        <output className="volume-readout">
          <strong>{Math.round(state.volume * 100)}</strong>
          <small>%</small>
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
