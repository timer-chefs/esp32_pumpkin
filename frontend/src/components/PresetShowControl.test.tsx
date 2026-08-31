import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { PresetShowControl } from "./PresetShowControl.tsx";

describe("PresetShowControl", () => {
  it("reports folder status and delegates show actions", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<PresetShowControl />, {
      state: { folderStatus: "success" },
    });

    expect(screen.getByText("Audio folder ready")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Audio folder" }));
    await user.click(screen.getByRole("button", { name: "Ghost" }));

    expect(controller.actions.selectAudioFolder).toHaveBeenCalledOnce();
    expect(controller.actions.playGhostShow).toHaveBeenCalledOnce();
  });

  it("reports an unavailable folder", () => {
    renderWithAppContext(<PresetShowControl />, {
      state: { folderStatus: "error" },
    });
    expect(screen.getByText("Audio folder unavailable")).toBeVisible();
  });
});
