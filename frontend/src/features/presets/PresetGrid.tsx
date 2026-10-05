import { useEffect, type CSSProperties } from "react";
import { Alert, Button } from "react-bootstrap";

import { useSdCard } from "../sd_card/sd_card_slice.ts";
import { presetIcons, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";
import "./presets.css";

export function PresetGrid() {
  const { presets, error, play } = usePresets();
  const { files, isLoading, refresh } = useSdCard();

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

  return (
    <section className="control-section" aria-labelledby="presets-heading">
      <div className="section-heading">
        <h2 id="presets-heading">Presets</h2>
        <span className="text-body-secondary">Lights, sound and eye</span>
      </div>

      <div className="preset-grid">
        {presets.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            isSoundMissing={
              preset.sound !== null &&
              filesOnCard !== null &&
              !filesOnCard.has(preset.sound.toLowerCase())
            }
            onPlay={() => play(preset.id)}
          />
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}
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
    "--preset-color": preset.light?.color ?? "var(--pumpkin-line)",
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
      <span className="preset-name">{preset.name}</span>
      <span
        className={`preset-sound text-truncate ${isSoundMissing ? "text-danger" : "text-body-secondary"}`}
      >
        {preset.sound === null
          ? "No sound"
          : isSoundMissing
            ? `${preset.sound} missing`
            : preset.sound}
      </span>
    </Button>
  );
}
