import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { VolumeControl } from "./VolumeControl.tsx";

describe("VolumeControl", () => {
  it("rounds the volume percentage and delegates adjustments", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<VolumeControl />, {
      state: { volume: 0.456 },
    });

    expect(screen.getByText("46")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Decrease volume" }));
    expect(controller.actions.decreaseVolume).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Increase volume" }));
    expect(controller.actions.increaseVolume).toHaveBeenCalledOnce();
  });
});
