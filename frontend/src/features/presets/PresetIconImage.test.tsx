import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PresetIconImage } from "./PresetIconImage.tsx";

function iconClass(name: string) {
  const { container } = render(<PresetIconImage name={name} />);
  return container.querySelector("svg")?.getAttribute("class");
}

describe("PresetIconImage", () => {
  it("draws an icon the page carries", () => {
    expect(iconClass("cloud-lightning")).toContain("lucide-cloud-lightning");
  });

  it("draws a question mark for an icon it can't", () => {
    expect(iconClass("cat")).toContain("lucide-circle-question-mark");
    expect(iconClass("constructor")).toContain("lucide-circle-question-mark");
  });
});
