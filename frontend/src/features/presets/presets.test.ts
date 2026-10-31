import { describe, expect, it } from "vitest";

import { LightEffectId } from "../../generated/pumpkin/protocol.ts";
import { testPresets } from "../../test/test_presets.ts";
import { changeTo, hasChanges } from "./presets.ts";

const [ghost, scream, wolf] = testPresets;
const saved = [ghost, scream, wolf];

describe("changeTo", () => {
  it("finds nothing done to a preset that's the same as it was", () => {
    expect(changeTo({ ...scream }, saved)).toBeNull();
  });

  it("finds a preset with any part of it changed", () => {
    for (const change of [
      { name: "Shriek" },
      { icon: "cat" },
      { light: null },
      { light: { effect: LightEffectId.CANDLE, color: "#ff0000" } },
      { light: { effect: LightEffectId.AUDIO_REACTIVE, color: "#ff0001" } },
      { sound: null },
      { eye: wolf.eye },
    ]) {
      expect(changeTo({ ...scream, ...change }, saved)).toBe("changed");
    }
  });

  it("finds a preset that wasn't saved before", () => {
    expect(changeTo({ ...scream, id: "added" }, saved)).toBe("new");
  });
});

describe("hasChanges", () => {
  it("finds none in the presets as they were", () => {
    expect(
      hasChanges(
        saved.map((preset) => ({ ...preset })),
        saved,
      ),
    ).toBe(false);
  });

  it("finds presets added, taken away, changed or put in another order", () => {
    expect(hasChanges([...saved, { ...wolf, id: "added" }], saved)).toBe(true);
    expect(hasChanges([ghost, wolf], saved)).toBe(true);
    expect(
      hasChanges([ghost, { ...scream, name: "Shriek" }, wolf], saved),
    ).toBe(true);
    expect(hasChanges([scream, ghost, wolf], saved)).toBe(true);
  });
});
