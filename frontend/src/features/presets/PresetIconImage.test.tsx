import type { IconNode } from "lucide-react";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import type { IconSet } from "./icon_set_slice.ts";
import { PresetIconImage } from "./PresetIconImage.tsx";

const cat: IconNode = [["path", { d: "M1 1h2", key: "0" }]];

function iconOf(name: string, icons: IconSet | null = null) {
  const { container } = renderWithAppContext(<PresetIconImage name={name} />, {
    state: { iconSet: { icons } },
  });
  return container.querySelector("svg");
}

describe("PresetIconImage", () => {
  it("draws an icon the page carries", () => {
    expect(iconOf("cloud-lightning")?.getAttribute("class")).toContain(
      "lucide-cloud-lightning",
    );
  });

  it("draws an icon from the SD card's file of them", () => {
    const icon = iconOf("cat", new Map([["cat", cat]]));

    expect(icon?.getAttribute("class")).toContain("lucide-cat");
    expect(icon?.querySelector("path")?.getAttribute("d")).toBe("M1 1h2");
  });

  it("draws a question mark for an icon it can't find", () => {
    for (const name of ["cat", "constructor"]) {
      expect(iconOf(name, new Map())?.getAttribute("class")).toContain(
        "lucide-circle-question-mark",
      );
    }
  });
});
