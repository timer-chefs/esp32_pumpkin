import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { AutoModeControl } from "./AutoModeControl.tsx";

describe("AutoModeControl", () => {
  it("starts auto mode when it isn't running", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { isRunning: false } },
    });

    const button = screen.getByRole("button", { name: "Auto mode" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);

    expect(controller.actions.autoMode.start).toHaveBeenCalledOnce();
    expect(controller.actions.autoMode.stop).not.toHaveBeenCalled();
  });

  it("stops auto mode when it is running", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { isRunning: true } },
    });

    const button = screen.getByRole("button", { name: "Auto mode" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);

    expect(controller.actions.autoMode.stop).toHaveBeenCalledOnce();
    expect(controller.actions.autoMode.start).not.toHaveBeenCalled();
  });

  it("picks how long to pause", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />);

    const select = screen.getByRole("combobox", {
      name: "Pause between presets",
    });
    expect(select).toHaveDisplayValue("Pause 15–45 s");
    await user.selectOptions(select, "Pause 1–3 min");

    expect(
      controller.actions.autoMode.setPause,
    ).toHaveBeenCalledExactlyOnceWith("long");
  });

  it("reports what went wrong", () => {
    renderWithAppContext(<AutoModeControl />, {
      state: {
        autoMode: { error: "Could not start auto mode: No SD card" },
      },
    });

    expect(
      screen.getByText("Could not start auto mode: No SD card"),
    ).toBeVisible();
  });
});
