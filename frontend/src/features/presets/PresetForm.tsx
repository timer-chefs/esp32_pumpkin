import { useState } from "react";
import { Form, ToggleButton } from "react-bootstrap";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import { useSdCard } from "../sd_card/sd_card_slice.ts";
import { type IconSet, useIconSet } from "./icon_set_slice.ts";
import { PresetIconImage } from "./PresetIconImage.tsx";
import { presetIcons, type Preset } from "./presets.ts";
import type { PresetChanges } from "./presets_slice.ts";

/** As many matches as fit a phone's screen without scrolling past them. */
const shownIconCount = 48;

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
  const { icons, error: iconsError } = useIconSet();
  const [iconQuery, setIconQuery] = useState("");
  const iconChoices = findIcons(iconQuery, icons, preset.icon);
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
        {icons && (
          <Form.Control
            type="search"
            className="mb-2"
            placeholder={`Search all ${icons.size} icons`}
            aria-label="Search the icons"
            value={iconQuery}
            onChange={(event) => setIconQuery(event.target.value)}
          />
        )}
        <div className="preset-icon-choices">
          {iconChoices.shown.map((icon) => (
            <ToggleButton
              key={icon}
              id={`preset-icon-${icon}`}
              type="radio"
              name="preset-icon"
              value={icon}
              checked={preset.icon === icon}
              onChange={() => onChange({ icon })}
              variant="outline-dark"
              title={icon}
            >
              <PresetIconImage name={icon} />
              <span className="visually-hidden">{labelOf(icon)}</span>
            </ToggleButton>
          ))}
        </div>
        {iconQuery.trim() !== "" && iconChoices.shown.length === 0 && (
          <Form.Text>No icon has a name like that.</Form.Text>
        )}
        {iconChoices.notShown > 0 && (
          <Form.Text>
            {iconChoices.notShown} more match. Keep typing to narrow them down.
          </Form.Text>
        )}
        {iconsError !== null && (
          <Form.Text>
            The rest of Lucide's icons couldn't be fetched from the internet.
          </Form.Text>
        )}
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

/**
 * The icons that match what was typed, best first. Before anything is
 * typed, or without the icon file, the icons the page carries, along with
 * the preset's own.
 */
function findIcons(
  query: string,
  icons: IconSet | null,
  current: string,
): { shown: string[]; notShown: number } {
  const words = query
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((word) => word !== "");

  if (words.length === 0 || !icons) {
    const builtIn = Object.keys(presetIcons);
    return {
      shown: builtIn.includes(current) ? builtIn : [current, ...builtIn],
      notShown: 0,
    };
  }

  const typed = words.join("-");
  // The icon called just that, then the ones whose names start that way:
  // "cat" before "cat-sleeping" before "sleeping-cat".
  const rank = (name: string) =>
    name === typed ? 0 : name.startsWith(typed) ? 1 : 2;
  // Each word typed starts one of the name's: "light" finds
  // cloud-lightning, but "cat" doesn't find locate.
  const matches = [...icons.keys()]
    .filter((name) => {
      const nameWords = name.split("-");
      return words.every((word) =>
        nameWords.some((nameWord) => nameWord.startsWith(word)),
      );
    })
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return {
    shown: matches.slice(0, shownIconCount),
    notShown: Math.max(0, matches.length - shownIconCount),
  };
}

/** An enum's values, each named as the protocol names it, but for a person. */
function optionsOf<Value extends number>(
  enumeration: Record<string, string | Value>,
): (readonly [Value, string])[] {
  return Object.entries(enumeration)
    .filter((entry): entry is [string, Value] => typeof entry[1] === "number")
    .map(([name, value]) => [value, labelOf(name)] as const);
}

/** AUDIO_REACTIVE as "Audio reactive", and cloud-lightning as "Cloud lightning". */
function labelOf(name: string): string {
  const words = name.toLowerCase().replaceAll(/[_-]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
