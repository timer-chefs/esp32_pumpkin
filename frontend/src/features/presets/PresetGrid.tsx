import { Plus } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Alert, Button, Modal } from "react-bootstrap";

import { useSdCard } from "../sd_card/sd_card_slice.ts";
import "./presets.css";
import { presetIcons, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";

/** How many presets fit on the page; the rest are a press of "More" away. */
const shownPresetCount = 5;

export function PresetGrid() {
  const { presets, error, play } = usePresets();
  const { files, isLoading, refresh } = useSdCard();
  const [isShowingAll, setIsShowingAll] = useState(false);

  // Knowing what's on the card is what lets a preset say its sound is missing.
  useEffect(() => {
    if (files === null && !isLoading) {
      refresh();
    }
  }, []);

  // The card's file system ignores case, so a preset finds its sound however
  // the file happens to be spelled.
  const filesOnCard =
    files && new Set(files.map((file) => file.name.toLowerCase()));

  const presetButton = (preset: Preset) => (
    <PresetButton
      key={preset.id}
      preset={preset}
      isSoundMissing={
        preset.sound !== null &&
        filesOnCard !== null &&
        !filesOnCard.has(preset.sound.toLowerCase())
      }
      onPlay={() => {
        setIsShowingAll(false);
        play(preset.id);
      }}
    />
  );

  return (
    <section className="control-section" aria-labelledby="presets-heading">
      <div className="section-heading">
        <h2 id="presets-heading">Presets</h2>
        <span className="text-body-secondary">Lights, sound and eye</span>
      </div>

      <div className="preset-grid">
        {presets.slice(0, shownPresetCount).map(presetButton)}
        <Button
          variant="light"
          className="preset-button"
          onClick={() => setIsShowingAll(true)}
        >
          <span className="preset-icon">
            <Plus aria-hidden="true" />
          </span>
          <span className="preset-name text-body-secondary">More</span>
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}

      <Modal
        show={isShowingAll}
        onHide={() => setIsShowingAll(false)}
        animation={false}
        fullscreen
        contentClassName="all-presets"
        aria-labelledby="all-presets-heading"
      >
        <Modal.Header closeButton>
          <Modal.Title as="h2" id="all-presets-heading">
            All presets
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="preset-grid">{presets.map(presetButton)}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setIsShowingAll(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

interface PresetButtonProps {
  preset: Preset;
  isSoundMissing: boolean;
  onPlay: () => void;
}

function PresetButton({ preset, isSoundMissing, onPlay }: PresetButtonProps) {
  const Icon = presetIcons[preset.icon];
  const style = {
    "--preset-color": preset.light?.color,
  } as CSSProperties;

  return (
    <Button
      variant="light"
      className="preset-button"
      style={style}
      onClick={onPlay}
    >
      <span className="preset-icon">
        <Icon aria-hidden="true" />
      </span>
      <span
        className={`preset-name ${isSoundMissing ? "text-danger" : "text-body-secondary"}`}
      >
        {preset.name}
      </span>
    </Button>
  );
}
