import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { AppHeader } from "./AppHeader.tsx";

describe("AppHeader", () => {
  it("presents the current mode and stream", () => {
    renderWithAppContext(<AppHeader />, {
      state: { currentMode: "Audio File", currentStreaming: "ghost.wav" },
    });

    expect(screen.getByText("Audio File")).toBeVisible();
    expect(screen.getByText("ghost.wav")).toBeVisible();
  });

  it("omits the stream label when nothing is streaming", () => {
    renderWithAppContext(<AppHeader />);

    expect(screen.getByText("Idle")).toBeVisible();
    expect(screen.queryByText("ghost.wav")).not.toBeInTheDocument();
  });
});
