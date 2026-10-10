import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { EyeCalibration } from "./EyeCalibration.tsx";

const calibration = {
  ball: { min: 20, max: 160 },
  lid: { min: 0, max: 180 },
};

function renderLoaded(draft = calibration) {
  return renderWithAppContext(<EyeCalibration />, {
    state: { calibration: { saved: calibration, draft } },
  });
}

describe("EyeCalibration", () => {
  it("reads the calibration when it hasn't been yet", () => {
    const { controller } = renderWithAppContext(<EyeCalibration />);

    expect(controller.actions.calibration.load).toHaveBeenCalledOnce();
  });

  it("offers to try again when the calibration couldn't be read", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<EyeCalibration />, {
      state: { calibration: { error: "Could not read the calibration" } },
    });

    await user.click(
      screen.getByRole("button", { name: "Read the calibration" }),
    );

    expect(screen.getByText("Could not read the calibration")).toBeVisible();
    expect(controller.actions.calibration.load).toHaveBeenCalledTimes(2);
  });

  it("shows each end of each servo's range", () => {
    renderLoaded();

    expect(screen.getByRole("slider", { name: "Eye min" })).toHaveValue("20");
    expect(screen.getByRole("slider", { name: "Eye max" })).toHaveValue("160");
    expect(screen.getByRole("slider", { name: "Lid min" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Lid max" })).toHaveValue("180");
  });

  it("sets an end as its slider is dragged", () => {
    const { controller } = renderLoaded();

    fireEvent.change(screen.getByRole("slider", { name: "Lid max" }), {
      target: { value: "150" },
    });

    expect(
      controller.actions.calibration.setAngle,
    ).toHaveBeenCalledExactlyOnceWith("lid", "max", 150);
  });

  it("nudges an end a degree at a time", async () => {
    const user = userEvent.setup();
    const { controller } = renderLoaded();

    await user.click(screen.getByRole("button", { name: "Increase Eye min" }));
    await user.click(screen.getByRole("button", { name: "Decrease Eye max" }));

    expect(controller.actions.calibration.setAngle).toHaveBeenNthCalledWith(
      1,
      "ball",
      "min",
      21,
    );
    expect(controller.actions.calibration.setAngle).toHaveBeenNthCalledWith(
      2,
      "ball",
      "max",
      159,
    );
  });

  it("can't nudge past the angles a servo takes", () => {
    renderLoaded();

    expect(
      screen.getByRole("button", { name: "Decrease Lid min" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Increase Lid max" }),
    ).toBeDisabled();
  });

  it("moves the servo to an end as its slider is taken hold of", () => {
    const { controller } = renderLoaded();

    fireEvent.pointerDown(screen.getByRole("slider", { name: "Eye max" }));

    expect(controller.actions.calibration.preview).toHaveBeenCalledWith(
      "ball",
      "max",
    );
  });

  it("saves a servo's range once it has changed", async () => {
    const user = userEvent.setup();
    const { controller } = renderLoaded({
      ...calibration,
      lid: { min: 10, max: 170 },
    });
    const eye = screen.getByRole("region", { name: "Eye" });
    const lid = screen.getByRole("region", { name: "Lid" });

    expect(within(eye).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(lid).getByText("Not saved yet")).toBeVisible();

    await user.click(within(lid).getByRole("button", { name: "Save" }));
    await user.click(within(lid).getByRole("button", { name: "Revert" }));

    expect(controller.actions.calibration.save).toHaveBeenCalledExactlyOnceWith(
      "lid",
    );
    expect(
      controller.actions.calibration.revert,
    ).toHaveBeenCalledExactlyOnceWith("lid");
  });

  it("holds off saving while another range is being saved", () => {
    renderWithAppContext(<EyeCalibration />, {
      state: {
        calibration: {
          saved: calibration,
          draft: { ball: { min: 30, max: 150 }, lid: { min: 10, max: 170 } },
          saving: "ball",
        },
      },
    });

    const lid = screen.getByRole("region", { name: "Lid" });
    expect(within(lid).getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
