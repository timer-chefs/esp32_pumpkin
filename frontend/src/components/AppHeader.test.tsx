import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { AppHeader } from "./AppHeader.tsx";

describe("AppHeader", () => {
  it("keeps the heading accessible while the pumpkin emblem is decorative", () => {
    renderWithAppContext(<AppHeader />);

    const heading = screen.getByRole("heading", { level: 1, name: "Pumpkin" });
    expect(heading).toBeVisible();
    const emblem = heading.querySelector("svg");
    expect(emblem).toHaveAttribute("aria-hidden", "true");
    expect(emblem).toHaveAttribute("focusable", "false");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("presents the current mode and stream", () => {
    renderWithAppContext(<AppHeader />, {
      state: { status: { mode: "Audio File", streaming: "ghost.wav" } },
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
