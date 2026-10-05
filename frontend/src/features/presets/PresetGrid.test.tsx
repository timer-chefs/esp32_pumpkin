import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { PresetGrid } from "./PresetGrid.tsx";

describe("PresetGrid", () => {
  it("plays the preset that is pressed", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<PresetGrid />);

    await user.click(screen.getByRole("button", { name: /Ghost/ }));

    expect(controller.actions.presets.play).toHaveBeenCalledExactlyOnceWith(
      "ghost",
    );
  });

  it("lists the SD card when it hasn't been yet", () => {
    const { controller } = renderWithAppContext(<PresetGrid />);

    expect(controller.actions.sdCard.refresh).toHaveBeenCalledOnce();
  });

  it("points out a sound that isn't on the SD card", () => {
    renderWithAppContext(<PresetGrid />, {
      state: { sdCard: { files: [{ name: "Ghost.wav", size: 1 }] } },
    });

    expect(screen.getByRole("button", { name: /Ghost/ })).toHaveTextContent(
      /ghost\.wav$/,
    );
    expect(screen.getByRole("button", { name: /Witch/ })).toHaveTextContent(
      "witch.wav missing",
    );
    expect(screen.getByRole("button", { name: /Calm/ })).toHaveTextContent(
      "No sound",
    );
  });

  it("reports a preset that couldn't be played", () => {
    renderWithAppContext(<PresetGrid />, {
      state: { presets: { error: "Could not play Ghost: No SD card" } },
    });

    expect(screen.getByText("Could not play Ghost: No SD card")).toBeVisible();
  });
});
