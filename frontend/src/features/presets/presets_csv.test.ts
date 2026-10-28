import { describe, expect, it } from "vitest";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import { defaultPresets, type Preset } from "./presets.ts";
import { fallbackIcon, parsePresetsCsv, presetsToCsv } from "./presets_csv.ts";

/** Ids are handed out afresh on every read, so they're left out. */
function withoutIds(presets: Preset[]) {
  return presets.map(({ id: _id, ...preset }) => preset);
}

function onlyPreset(text: string) {
  const { presets, problems } = parsePresetsCsv(text);
  expect(presets).toHaveLength(1);
  return { preset: presets[0], problems };
}

describe("presetsToCsv", () => {
  it("writes a header, then a row per preset, as a person would read it", () => {
    const lines = presetsToCsv(defaultPresets).split("\r\n");

    expect(lines.slice(0, 2)).toEqual([
      "﻿name,icon,light,color,sound,eye",
      "Ghost,ghost,audio_reactive,#8000ff,ghost.wav,wander",
    ]);
    expect(lines).toContain("Candles,flame,candle,#ffa500,,sleep");
    expect(lines).toHaveLength(defaultPresets.length + 2);
    expect(lines.at(-1)).toBe("");
  });

  it("writes a preset that leaves the lights alone without a color", () => {
    const [ghost] = defaultPresets;

    expect(presetsToCsv([{ ...ghost, light: null }])).toContain(
      "Ghost,ghost,none,,ghost.wav,wander",
    );
  });

  it("quotes a name that would otherwise split the row", () => {
    const [ghost] = defaultPresets;
    const name = 'Boo, the "friendly"; one';

    expect(presetsToCsv([{ ...ghost, name }])).toContain(
      '"Boo, the ""friendly""; one",ghost',
    );
  });

  it("writes the same presets the same way every time", () => {
    // The device compares what it's sent with what it has, and only keeps a
    // backup when they differ.
    expect(presetsToCsv(defaultPresets)).toBe(presetsToCsv(defaultPresets));
  });
});

describe("parsePresetsCsv", () => {
  it("reads back what was written", () => {
    const presets = [
      ...defaultPresets,
      { ...defaultPresets[0], name: 'Boo, the "friendly"\none', light: null },
    ];

    const parsed = parsePresetsCsv(presetsToCsv(presets));

    expect(parsed.problems).toEqual([]);
    expect(withoutIds(parsed.presets)).toEqual(withoutIds(presets));
  });

  it("gives every preset an id of its own", () => {
    const { presets } = parsePresetsCsv(presetsToCsv(defaultPresets));

    expect(new Set(presets.map((preset) => preset.id)).size).toBe(
      defaultPresets.length,
    );
  });

  it("reads the columns in any order and fills in the ones that are missing", () => {
    const { preset, problems } = onlyPreset("eye,name\nstare,Scream\n");

    expect(problems).toEqual([]);
    expect(preset).toMatchObject({
      name: "Scream",
      icon: fallbackIcon,
      light: null,
      sound: null,
      eye: EyeEffectId.STARE,
    });
  });

  it("reads a file a spreadsheet saved with semicolons", () => {
    const { preset, problems } = onlyPreset(
      "﻿Name;Icon;Light;Color;Sound;Eye\r\n" +
        "Häxa, the witch;Wand;Audio_Reactive;#33FF33;witch.wav;SHIFTY\r\n" +
        ";;;;;\r\n",
    );

    expect(problems).toEqual([]);
    expect(preset).toMatchObject({
      name: "Häxa, the witch",
      icon: "wand",
      light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#33ff33" },
      sound: "witch.wav",
      eye: EyeEffectId.SHIFTY,
    });
  });

  it("forgives the spaces and blank lines of a file typed by hand", () => {
    const { presets, problems } = parsePresetsCsv(
      "\n  name, light, color\n\nWolf, candle, 3366ff\n\n",
    );

    expect(problems).toEqual([]);
    expect(presets).toMatchObject([
      {
        name: "Wolf",
        light: { effect: LightEffectId.CANDLE, color: "#3366ff" },
      },
    ]);
  });

  it("takes a quote inside a name as part of it", () => {
    const { preset } = onlyPreset('name\n12" ghost\n');

    expect(preset.name).toBe('12" ghost');
  });

  it("points out what it can't read and keeps the rest of the row", () => {
    const { presets, problems } = parsePresetsCsv(
      [
        "name,icon,light,color,sound,eye,notes",
        "Ghost,bat,audio_reactive,purple,ghost.wav,wnder,spooky",
        ",ghost,strobe,,,",
        "Wolf,moon,candle,,wolf.wav,",
      ].join("\n"),
    );

    expect(problems).toEqual([
      `There's no "notes" column, so it's left out when the presets are saved`,
      'Line 2: "bat" isn\'t an icon (flame, ghost, lightning, moon, skull, wand)',
      `Line 2: "purple" isn't a color like #ff8800`,
      `Line 2: "wnder" isn't an eye effect (none, wander, shifty, stare, sleep)`,
      "Line 3: there's no name",
      `Line 3: "strobe" isn't a light (none, candle, audio_reactive)`,
      "Line 4: there's a light but no color",
    ]);
    expect(withoutIds(presets)).toEqual([
      {
        name: "Ghost",
        icon: fallbackIcon,
        light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ffa500" },
        sound: "ghost.wav",
        eye: EyeEffectId.NONE,
      },
      {
        name: "Unnamed",
        icon: "ghost",
        light: null,
        sound: null,
        eye: EyeEffectId.NONE,
      },
      {
        name: "Wolf",
        icon: "moon",
        light: { effect: LightEffectId.CANDLE, color: "#ffa500" },
        sound: "wolf.wav",
        eye: EyeEffectId.NONE,
      },
    ]);
  });

  it("counts the lines of a quoted line break when pointing at a problem", () => {
    const { problems } = parsePresetsCsv(
      'name,eye\n"Two\nlines",none\nOne,wnder\n',
    );

    expect(problems).toEqual([
      `Line 4: "wnder" isn't an eye effect (none, wander, shifty, stare, sleep)`,
    ]);
  });

  it("points out a quote that's never closed", () => {
    const { presets, problems } = parsePresetsCsv('name\n"Ghost\n');

    expect(problems).toEqual(["Line 2: a quote is never closed"]);
    expect(presets).toHaveLength(1);
  });

  it("starts from nothing when the file doesn't name its columns", () => {
    expect(
      parsePresetsCsv("Ghost,ghost,candle,#ffffff,ghost.wav,wander\n"),
    ).toEqual({
      presets: [],
      problems: [
        "The first line should name the columns: name, icon, light, color, sound, eye",
      ],
    });
  });

  it("reads an empty file as no presets", () => {
    expect(parsePresetsCsv("")).toEqual({ presets: [], problems: [] });
    expect(parsePresetsCsv(presetsToCsv([]))).toEqual({
      presets: [],
      problems: [],
    });
  });
});
