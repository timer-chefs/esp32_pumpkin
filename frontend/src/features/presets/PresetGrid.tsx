import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";

import { useSdCard } from "../sd_card/sd_card_slice.ts";
import "./presets.css";
import { presetIcons, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";

/** How many presets fit on the page; the rest are a press of "More" away. */
const shownPresetCount = 5;

export function PresetGrid() {
  const { presets, problems, isLoading, error, load, play } = usePresets();
  const { files, isLoading: isListingCard, refresh } = useSdCard();
  const [isShowingAll, setIsShowingAll] = useState(false);

  useEffect(() => {
    if (presets === null && !isLoading) {
      load();
    }

    // Knowing what's on the card is what lets a preset say its sound is
    // missing.
    if (files === null && !isListingCard) {
      refresh();
    }
  }, []);

  if (presets === null) {
    return (
      <section className="control-section" aria-label="Presets">
        <p className="empty-state mb-0">
          {isLoading ? (
            <Spinner
              animation="border"
              size="sm"
              aria-label="Reading the presets"
            />
          ) : (
            <Button
              variant="outline-dark"
              className="icon-label-button"
              onClick={load}
            >
              <RefreshCw aria-hidden="true" />
              Read the presets
            </Button>
          )}
        </p>

        {error && (
          <Alert variant="danger" className="compact-alert" aria-live="polite">
            {error}
          </Alert>
        )}
      </section>
    );
  }

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
    <section className="control-section" aria-label="Presets">
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

      {problems.length > 0 && (
        <Alert variant="warning" className="compact-alert">
          <details>
            <summary>
              {problems.length === 1
                ? "Part of presets.csv couldn't be read"
                : `${problems.length} parts of presets.csv couldn't be read`}
            </summary>
            <ul className="preset-problems">
              {problems.map((problem, index) => (
                <li key={index}>{problem}</li>
              ))}
            </ul>
          </details>
        </Alert>
      )}

      <Modal
        show={isShowingAll}
        onHide={() => setIsShowingAll(false)}
        animation={false}
        fullscreen
        contentClassName="app-modal all-presets"
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
          <Button variant="dark" onClick={() => setIsShowingAll(false)}>
            Close
          </Button>
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
      className={`preset-button${preset.light ? " preset-button--lit" : ""}`}
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
