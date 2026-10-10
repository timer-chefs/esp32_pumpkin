import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { EyeControl } from "./EyeControl.tsx";

describe("EyeControl", () => {
  it("turns the eye as the direction slider is dragged", () => {
    const { controller } = renderWithAppContext(<EyeControl />);

    fireEvent.change(screen.getByRole("slider", { name: "Eye direction" }), {
      target: { value: "-64" },
    });

    expect(controller.actions.eye.look).toHaveBeenCalledExactlyOnceWith(-64);
  });

  it("moves the lid as the lid slider is dragged", () => {
    const { controller } = renderWithAppContext(<EyeControl />);

    fireEvent.change(screen.getByRole("slider", { name: "Eye lid" }), {
      target: { value: "10" },
    });

    expect(controller.actions.eye.moveLid).toHaveBeenCalledExactlyOnceWith(10);
  });

  it("describes where the eye is", () => {
    renderWithAppContext(<EyeControl />, {
      state: { eye: { position: 127, lid: 0 } },
    });

    expect(
      screen.getByRole("slider", { name: "Eye direction" }),
    ).toHaveAttribute("aria-valuetext", "100% right");
    expect(screen.getByRole("slider", { name: "Eye lid" })).toHaveAttribute(
      "aria-valuetext",
      "0% open",
    );
  });
});
