import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import type { IconSetState } from "./icon_set_slice.ts";
import { PresetForm } from "./PresetForm.tsx";
import { defaultPresets, type Preset } from "./presets.ts";

const [ghost] = defaultPresets;

function renderForm(
  preset: Preset = ghost,
  files = ["wolf.wav", "Ghost.wav"],
  iconSet: Partial<IconSetState> = {},
) {
  const onChange = vi.fn();
  renderWithAppContext(<PresetForm preset={preset} onChange={onChange} />, {
    state: {
      sdCard: { files: files.map((name) => ({ name, size: 1 })) },
      iconSet,
    },
  });
  return onChange;
}

/** Icons by those names, drawn alike, as the SD card's file would hold. */
function iconSet(...names: string[]) {
  return new Map(
    names.map((name) => [name, [["path", { d: "M1 1", key: "0" }]]] as const),
  ) as IconSetState["icons"];
}

function shownIcons() {
  return screen
    .getAllByRole("radio")
    .map((radio) => radio.getAttribute("value"));
}

describe("PresetForm", () => {
  it("shows every part of the preset", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toHaveValue("Ghost");
    expect(screen.getByRole("radio", { name: "Ghost" })).toBeChecked();
    expect(screen.getByLabelText("Light")).toHaveDisplayValue("Audio reactive");
    expect(screen.getByLabelText("Color")).toHaveValue("#8000ff");
    // Found on the card however the file there is spelled.
    expect(screen.getByLabelText("Sound")).toHaveDisplayValue("Ghost.wav");
    expect(screen.getByLabelText("Eye")).toHaveDisplayValue("Wander");
  });

  it("changes the name, icon, sound and eye", async () => {
    const user = userEvent.setup();
    const onChange = renderForm();

    await user.type(screen.getByLabelText("Name"), "!");
    await user.click(screen.getByRole("radio", { name: "Moon" }));
    await user.selectOptions(screen.getByLabelText("Sound"), "wolf.wav");
    await user.selectOptions(screen.getByLabelText("Sound"), "No sound");
    await user.selectOptions(screen.getByLabelText("Eye"), "Stare");

    expect(onChange.mock.calls).toEqual([
      [{ name: "Ghost!" }],
      [{ icon: "moon" }],
      [{ sound: "wolf.wav" }],
      [{ sound: null }],
      [{ eye: EyeEffectId.STARE }],
    ]);
  });

  it("offers the icons the page carries until something is searched for", () => {
    renderForm(ghost, [], { icons: iconSet("cat", "ghost") });

    expect(shownIcons()).toEqual([
      "cloud-lightning",
      "flame",
      "ghost",
      "moon",
      "skull",
      "wand-sparkles",
    ]);
  });

  it("offers the preset's own icon too, when the page doesn't carry it", () => {
    renderForm({ ...ghost, icon: "cat" }, [], { icons: iconSet("cat") });

    expect(shownIcons()[0]).toBe("cat");
    expect(screen.getByRole("radio", { name: "Cat" })).toBeChecked();
  });

  it("finds icons by name, best matches first", async () => {
    const user = userEvent.setup();
    const onChange = renderForm(ghost, [], {
      icons: iconSet(
        "sleeping-cat",
        "locate",
        "cat-sleeping",
        "cat",
        "cloud-lightning",
      ),
    });

    await user.type(screen.getByLabelText("Search the icons"), "cat");

    expect(shownIcons()).toEqual(["cat", "cat-sleeping", "sleeping-cat"]);
    await user.click(screen.getByRole("radio", { name: "Cat sleeping" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ icon: "cat-sleeping" });
  });

  it("finds an icon by the words of its name, in any order", async () => {
    const user = userEvent.setup();
    renderForm(ghost, [], {
      icons: iconSet("cloud-lightning", "cloud", "lightbulb"),
    });

    await user.type(screen.getByLabelText("Search the icons"), "light cl");

    expect(shownIcons()).toEqual(["cloud-lightning"]);
  });

  it("says how many more icons match than it shows", async () => {
    const user = userEvent.setup();
    const names = Array.from({ length: 50 }, (_, index) => `star-${index}`);
    renderForm(ghost, [], { icons: iconSet(...names) });

    await user.type(screen.getByLabelText("Search the icons"), "star");

    expect(shownIcons()).toHaveLength(48);
    expect(
      screen.getByText("2 more match. Keep typing to narrow them down."),
    ).toBeVisible();
  });

  it("says when no icon matches", async () => {
    const user = userEvent.setup();
    renderForm(ghost, [], { icons: iconSet("cat") });

    await user.type(screen.getByLabelText("Search the icons"), "bat");

    expect(screen.getByText("No icon has a name like that.")).toBeVisible();
  });

  it("says where the rest of the icons come from when they couldn't be fetched", () => {
    renderForm(ghost, [], { error: "Failed to fetch" });

    expect(screen.queryByLabelText("Search the icons")).toBeNull();
    expect(
      screen.getByText(/The rest of Lucide's icons couldn't be fetched/),
    ).toBeVisible();
  });

  it("takes the light away and puts it back in the same color", async () => {
    const user = userEvent.setup();
    const onChange = renderForm({ ...ghost, light: null });

    expect(screen.getByLabelText("Color")).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Light"), "Candle");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      light: { effect: LightEffectId.CANDLE, color: "#ff8800" },
    });
  });

  it("leaves the lights as they are when asked to", async () => {
    const user = userEvent.setup();
    const onChange = renderForm();

    await user.selectOptions(screen.getByLabelText("Light"), "Leave as it is");

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ light: null });
  });

  it("keeps a sound that isn't on the card, and says so", () => {
    renderForm({ ...ghost, sound: "boo.wav" });

    expect(screen.getByLabelText("Sound")).toHaveDisplayValue("boo.wav");
    expect(screen.getByText("boo.wav isn't on the SD card")).toBeVisible();
  });

  it("points out a preset without a name", () => {
    renderForm({ ...ghost, name: " " });

    expect(screen.getByLabelText("Name")).toHaveClass("is-invalid");
    expect(screen.getByText("A preset needs a name")).toBeInTheDocument();
  });
});
