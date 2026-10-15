import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { EyeControl } from "./EyeControl.tsx";
import { LID_OPEN } from "./eye_slice.ts";

describe("EyeControl", () => {
  it("turns the eye as the direction slider is dragged", () => {
    const { controller } = renderWithAppContext(<EyeControl />);

    fireEvent.change(screen.getByRole("slider", { name: "Eye direction" }), {
      target: { value: "-64" },
    });

    expect(controller.actions.eye.look).toHaveBeenCalledExactlyOnceWith(-64);
  });

  it("closes an open eye", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<EyeControl />, {
      state: { eye: { position: 0, lid: LID_OPEN } },
    });

    await user.click(screen.getByRole("button", { name: "Close eye" }));

    expect(controller.actions.eye.moveLid).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("opens a shut eye", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<EyeControl />, {
      state: { eye: { position: 0, lid: 0 } },
    });

    await user.click(screen.getByRole("button", { name: "Open eye" }));

    expect(controller.actions.eye.moveLid).toHaveBeenCalledExactlyOnceWith(
      LID_OPEN,
    );
  });

  it("describes where the eye is", () => {
    renderWithAppContext(<EyeControl />, {
      state: { eye: { position: 127, lid: 0 } },
    });

    expect(
      screen.getByRole("slider", { name: "Eye direction" }),
    ).toHaveAttribute("aria-valuetext", "100% right");
  });
});
