import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  EyeEffectId,
  LightEffectId,
} from "../../generated/pumpkin/protocol.ts";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { PresetForm } from "./PresetForm.tsx";
import { defaultPresets, type Preset } from "./presets.ts";

const [ghost] = defaultPresets;

function renderForm(preset: Preset = ghost, files = ["wolf.wav", "Ghost.wav"]) {
  const onChange = vi.fn();
  renderWithAppContext(<PresetForm preset={preset} onChange={onChange} />, {
    state: {
      sdCard: { files: files.map((name) => ({ name, size: 1 })) },
    },
  });
  return onChange;
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
