import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import {
  newPresetId,
  presetIcons,
  type Preset,
  type PresetIcon,
} from "./presets.ts";

// The presets as the device stores them: a CSV file on the SD card, which
// is also how they're backed up and edited on a computer. The device never
// reads it, so this is the only place that knows the format.
//
// The first row names the columns, so they can come in any order, and a
// column a file doesn't have takes its default. Effects are written by
// their names in the protocol, lowercased, so one added there can be
// written here without a change.

const columns = ["name", "icon", "light", "color", "sound", "eye"] as const;

type Column = (typeof columns)[number];

/** For a preset whose icon is missing or one this page doesn't have. */
export const fallbackIcon: PresetIcon = "ghost";

/** For a preset that lights the pumpkin without saying in what color. */
const fallbackColor = "#ffa500";

/** Written for a preset that leaves the lights as they are. */
const unchangedLight = "none";

/** Excel only reads a file as UTF-8 when it starts with this. */
const byteOrderMark = "﻿";

export interface ParsedPresets {
  presets: Preset[];
  /** What couldn't be read as it stood, and was left at its default. */
  problems: string[];
}

export function presetsToCsv(presets: Preset[]): string {
  const rows = [
    columns,
    ...presets.map((preset) => [
      preset.name,
      preset.icon,
      preset.light
        ? LightEffectId[preset.light.effect].toLowerCase()
        : unchangedLight,
      preset.light?.color ?? "",
      preset.sound ?? "",
      EyeEffectId[preset.eye].toLowerCase(),
    ]),
  ];

  return (
    byteOrderMark +
    rows.map((row) => row.map(quoteIfNeeded).join(",")).join("\r\n") +
    "\r\n"
  );
}

/**
 * Reads what it can of a file that may have been through a spreadsheet or a
 * text editor, rather than give up on all of it over one cell.
 */
export function parsePresetsCsv(text: string): ParsedPresets {
  const problems: string[] = [];
  // Blank lines, and the rows of nothing but commas that a spreadsheet
  // leaves behind, aren't presets.
  const records = readRecords(text.replace(/^﻿/, ""), problems).filter(
    (record) => record.fields.some((field) => field !== ""),
  );

  const header = records.shift();
  if (!header) {
    return { presets: [], problems };
  }

  const names = header.fields.map((field) => field.toLowerCase());
  if (!names.includes("name")) {
    problems.push(
      `The first line should name the columns: ${columns.join(", ")}`,
    );
    return { presets: [], problems };
  }

  for (const name of names) {
    if (name !== "" && !isColumn(name)) {
      problems.push(
        `There's no "${name}" column, so it's left out when the presets are saved`,
      );
    }
  }

  const presets = records.map((record) =>
    readPreset(
      (column) => record.fields[names.indexOf(column)] ?? "",
      (problem) => problems.push(`Line ${record.line}: ${problem}`),
    ),
  );

  return { presets, problems };
}

const icons = Object.keys(presetIcons);
const lightEffects = namesOf(LightEffectId);
const eyeEffects = namesOf(EyeEffectId);

function readPreset(
  cell: (column: Column) => string,
  report: (problem: string) => void,
): Preset {
  let name = cell("name");
  if (name === "") {
    report("there's no name");
    name = "Unnamed";
  }

  let icon = fallbackIcon;
  const iconName = cell("icon");
  const iconKey = iconName.toLowerCase();
  if (isIcon(iconKey)) {
    icon = iconKey;
  } else if (iconName !== "") {
    report(`"${iconName}" isn't an icon (${icons.join(", ")})`);
  }

  let light: Preset["light"] = null;
  const lightName = cell("light");
  if (lightName !== "" && lightName.toLowerCase() !== unchangedLight) {
    const effect = lightEffects.get(lightName.toLowerCase());
    if (effect === undefined) {
      report(
        `"${lightName}" isn't a light (${[unchangedLight, ...lightEffects.keys()].join(", ")})`,
      );
    } else {
      light = { effect, color: readColor(cell("color"), report) };
    }
  }

  let eye = EyeEffectId.NONE;
  const eyeName = cell("eye");
  if (eyeName !== "") {
    const effect = eyeEffects.get(eyeName.toLowerCase());
    if (effect === undefined) {
      report(
        `"${eyeName}" isn't an eye effect (${[...eyeEffects.keys()].join(", ")})`,
      );
    } else {
      eye = effect;
    }
  }

  const sound = cell("sound");

  return {
    id: newPresetId(),
    name,
    icon,
    light,
    sound: sound === "" ? null : sound,
    eye,
  };
}

function readColor(text: string, report: (problem: string) => void): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(text);
  if (!match) {
    report(
      text === ""
        ? "there's a light but no color"
        : `"${text}" isn't a color like #ff8800`,
    );
    return fallbackColor;
  }

  return `#${match[1].toLowerCase()}`;
}

interface CsvRecord {
  /** Where the record starts, counting from 1, for pointing out problems. */
  line: number;
  /** Trimmed, since a space after a comma is a person's, not the data's. */
  fields: string[];
}

/**
 * Splits CSV as RFC 4180 has it, and as Excel writes it: a field that holds
 * the delimiter, a quote or a line break is quoted, with its quotes doubled.
 * The delimiter is whichever of comma and semicolon the header uses, since
 * Excel uses a semicolon wherever a comma is the decimal separator.
 */
function readRecords(text: string, problems: string[]): CsvRecord[] {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter =
    firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let isQuoted = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    fields.push(field.trim());
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push({ line: recordLine, fields });
    fields = [];
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (isQuoted) {
      if (character !== '"') {
        if (character === "\n") {
          line += 1;
        }
        field += character;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        isQuoted = false;
      }
    } else if (character === '"' && field.trim() === "") {
      // A quote anywhere else is just a character, as a person typing one
      // into a name would mean it.
      isQuoted = true;
      field = "";
    } else if (character === delimiter) {
      endField();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      field += character;
    }
  }

  if (isQuoted) {
    problems.push(`Line ${recordLine}: a quote is never closed`);
  }

  if (field !== "" || fields.length > 0) {
    endRecord();
  }

  return records;
}

function quoteIfNeeded(field: string): string {
  return /[",;\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/** An enum's values by the names the file gives them. */
function namesOf<Value extends number>(
  enumeration: Record<string, string | Value>,
): Map<string, Value> {
  const names = new Map<string, Value>();
  for (const [name, value] of Object.entries(enumeration)) {
    if (typeof value === "number") {
      names.set(name.toLowerCase(), value);
    }
  }
  return names;
}

function isColumn(name: string): name is Column {
  return (columns as readonly string[]).includes(name);
}

function isIcon(name: string): name is PresetIcon {
  return Object.hasOwn(presetIcons, name);
}
