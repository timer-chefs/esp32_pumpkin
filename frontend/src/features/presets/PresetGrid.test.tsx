import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { PresetGrid } from "./PresetGrid.tsx";
import { defaultPresets } from "./presets.ts";
import type { PresetsState } from "./presets_slice.ts";

/** Renders the grid once the device has said what presets it has. */
function renderLoaded(
  presets: Partial<PresetsState> = {},
  sdCard: Parameters<typeof renderWithAppContext>[1] = {},
) {
  return renderWithAppContext(<PresetGrid />, {
    ...sdCard,
    state: {
      ...sdCard.state,
      presets: { presets: defaultPresets, ...presets },
    },
  });
}

describe("PresetGrid", () => {
  it("plays the preset that is pressed", async () => {
    const user = userEvent.setup();
    const { controller } = renderLoaded();

    await user.click(screen.getByRole("button", { name: /Ghost/ }));

    expect(controller.actions.presets.play).toHaveBeenCalledExactlyOnceWith(
      "ghost",
    );
  });

  it("shows the first five presets and a button for the rest", () => {
    renderLoaded();

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      ...defaultPresets.slice(0, 5).map((preset) => preset.name),
      "More",
    ]);
  });

  it("uses each preset's exact light color for its glow", () => {
    renderWithAppContext(<PresetGrid />);

    for (const preset of defaultPresets.slice(0, 5)) {
      const button = screen.getByRole("button", { name: preset.name });
      expect(button).toHaveClass("preset-button--lit");
      expect(button.style.getPropertyValue("--preset-color")).toBe(
        preset.light!.color,
      );
    }

    expect(screen.getByRole("button", { name: "More" })).not.toHaveClass(
      "preset-button--lit",
    );
  });

  it("keeps presets without a light neutral", () => {
    const preset = { ...defaultPresets[0], light: null };
    renderWithAppContext(<PresetGrid />, {
      state: { presets: { presets: [preset] } },
    });

    const button = screen.getByRole("button", { name: preset.name });
    expect(button).not.toHaveClass("preset-button--lit");
    expect(button.style.getPropertyValue("--preset-color")).toBe("");
  });

  it("shows every preset when More is pressed", async () => {
    const user = userEvent.setup();
    renderLoaded();

    await user.click(screen.getByRole("button", { name: "More" }));

    const dialog = screen.getByRole("dialog", { name: "All presets" });
    for (const preset of defaultPresets) {
      const button = within(dialog).getByRole("button", { name: preset.name });
      expect(button).toBeVisible();
      if (preset.light) {
        expect(button).toHaveClass("preset-button--lit");
        expect(button.style.getPropertyValue("--preset-color")).toBe(
          preset.light.color,
        );
      }
    }
  });

  it("plays a preset picked from all of them and goes back", async () => {
    const user = userEvent.setup();
    const { controller } = renderLoaded();
    const hiddenPreset = defaultPresets[5];

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: hiddenPreset.name,
      }),
    );

    expect(controller.actions.presets.play).toHaveBeenCalledExactlyOnceWith(
      hiddenPreset.id,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("reads the presets when it hasn't yet", () => {
    const { controller } = renderWithAppContext(<PresetGrid />);

    expect(controller.actions.presets.load).toHaveBeenCalledOnce();
  });

  it("says it is reading the presets", () => {
    const { controller } = renderWithAppContext(<PresetGrid />, {
      state: { presets: { isLoading: true } },
    });

    expect(screen.getByLabelText("Reading the presets")).toBeVisible();
    expect(controller.actions.presets.load).not.toHaveBeenCalled();
  });

  it("offers to read the presets again when they couldn't be", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<PresetGrid />, {
      state: {
        presets: { error: "Could not read the presets: No SD card detected" },
      },
    });

    expect(
      screen.getByText("Could not read the presets: No SD card detected"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Read the presets" }));

    // Once on its own, and once for the press.
    expect(controller.actions.presets.load).toHaveBeenCalledTimes(2);
  });

  it("points out what couldn't be read from the file", async () => {
    const user = userEvent.setup();
    renderLoaded({
      problems: [
        `Line 2: "wnder" isn't an eye effect`,
        "Line 3: there's no name",
      ],
    });

    await user.click(
      screen.getByText("2 parts of presets.csv couldn't be read"),
    );

    expect(screen.getByText("Line 3: there's no name")).toBeVisible();
  });

  it("lists the SD card when it hasn't been yet", () => {
    const { controller } = renderLoaded();

    expect(controller.actions.sdCard.refresh).toHaveBeenCalledOnce();
  });

  it("points out a sound that isn't on the SD card", () => {
    const [onCard, missing] = defaultPresets;
    renderLoaded(
      {},
      {
        state: {
          sdCard: { files: [{ name: onCard.sound!.toUpperCase(), size: 1 }] },
        },
      },
    );

    expect(screen.getByText(onCard.name)).not.toHaveClass("text-danger");
    expect(screen.getByText(missing.name)).toHaveClass("text-danger");
  });

  it("reports a preset that couldn't be played", () => {
    renderLoaded({ error: "Could not play Ghost: No SD card" });

    expect(screen.getByText("Could not play Ghost: No SD card")).toBeVisible();
  });
});
