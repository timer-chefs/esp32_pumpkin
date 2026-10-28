import { useState } from "react";
import { Form, ToggleButton, ToggleButtonGroup } from "react-bootstrap";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import { useSdCard } from "../sd_card/sd_card_slice.ts";
import { presetIcons, type Preset, type PresetIcon } from "./presets.ts";
import type { PresetChanges } from "./presets_slice.ts";

const icons = Object.keys(presetIcons) as PresetIcon[];

/** What the color input shows for a preset that doesn't light the pumpkin. */
const defaultColor = "#ff8800";

/** For a light or an eye effect that changes nothing. */
const unchangedLabel = "Leave as it is";

const lightOptions = optionsOf(LightEffectId);
const eyeOptions = optionsOf(EyeEffectId).map(([value, label]) =>
  value === EyeEffectId.NONE
    ? ([value, unchangedLabel] as const)
    : [value, label],
);

interface PresetFormProps {
  preset: Preset;
  onChange: (changes: PresetChanges) => void;
}

/** Every part of one preset. Changes go straight to the presets being edited. */
export function PresetForm({ preset, onChange }: PresetFormProps) {
  const { files } = useSdCard();
  // Kept for when a light that was taken away is put back.
  const [color, setColor] = useState(preset.light?.color ?? defaultColor);

  const soundsOnCard = (files ?? [])
    .map((file) => file.name)
    .sort((a, b) => a.localeCompare(b));
  // The card ignores case, so the file a preset names may be spelled
  // differently in the listing.
  const soundOnCard =
    preset.sound === null
      ? null
      : soundsOnCard.find(
          (name) => name.toLowerCase() === preset.sound!.toLowerCase(),
        );
  const isSoundMissing =
    preset.sound !== null && files !== null && soundOnCard === undefined;

  return (
    <Form className="preset-form" onSubmit={(event) => event.preventDefault()}>
      <Form.Group controlId="preset-name">
        <Form.Label>Name</Form.Label>
        <Form.Control
          value={preset.name}
          isInvalid={preset.name.trim() === ""}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Form.Control.Feedback type="invalid">
          A preset needs a name
        </Form.Control.Feedback>
      </Form.Group>

      <fieldset>
        <legend className="form-label">Icon</legend>
        <ToggleButtonGroup
          type="radio"
          name="preset-icon"
          className="preset-icon-picker"
          value={preset.icon}
          onChange={(icon: PresetIcon) => onChange({ icon })}
        >
          {icons.map((icon) => {
            const Icon = presetIcons[icon];
            return (
              <ToggleButton
                key={icon}
                id={`preset-icon-${icon}`}
                value={icon}
                variant="outline-dark"
              >
                <Icon aria-hidden="true" />
                <span className="visually-hidden">{labelOf(icon)}</span>
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </fieldset>

      <div className="preset-form-light">
        <Form.Group controlId="preset-light">
          <Form.Label>Light</Form.Label>
          <Form.Select
            value={preset.light?.effect ?? ""}
            onChange={(event) =>
              onChange({
                light:
                  event.target.value === ""
                    ? null
                    : {
                        effect: Number(event.target.value) as LightEffectId,
                        color,
                      },
              })
            }
          >
            <option value="">{unchangedLabel}</option>
            {lightOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group controlId="preset-color">
          <Form.Label>Color</Form.Label>
          <Form.Control
            type="color"
            value={preset.light?.color ?? color}
            disabled={preset.light === null}
            onChange={(event) => {
              setColor(event.target.value);
              if (preset.light) {
                onChange({
                  light: { ...preset.light, color: event.target.value },
                });
              }
            }}
          />
        </Form.Group>
      </div>

      <Form.Group controlId="preset-sound">
        <Form.Label>Sound</Form.Label>
        <Form.Select
          value={preset.sound === null ? "" : (soundOnCard ?? preset.sound)}
          onChange={(event) => onChange({ sound: event.target.value || null })}
        >
          <option value="">No sound</option>
          {preset.sound !== null && soundOnCard === undefined && (
            <option value={preset.sound}>{preset.sound}</option>
          )}
          {soundsOnCard.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Form.Select>
        {isSoundMissing && (
          <Form.Text className="text-danger">
            {preset.sound} isn't on the SD card
          </Form.Text>
        )}
      </Form.Group>

      <Form.Group controlId="preset-eye">
        <Form.Label>Eye</Form.Label>
        <Form.Select
          value={preset.eye}
          onChange={(event) =>
            onChange({ eye: Number(event.target.value) as EyeEffectId })
          }
        >
          {eyeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </Form>
  );
}

/** An enum's values, each named as the protocol names it, but for a person. */
function optionsOf<Value extends number>(
  enumeration: Record<string, string | Value>,
): (readonly [Value, string])[] {
  return Object.entries(enumeration)
    .filter((entry): entry is [string, Value] => typeof entry[1] === "number")
    .map(([name, value]) => [value, labelOf(name)] as const);
}

/** AUDIO_REACTIVE as "Audio reactive", and moon as "Moon". */
function labelOf(name: string): string {
  const words = name.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
