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

  it("shows the pause on the settings button", () => {
    renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { pause: { minS: 60, maxS: 180 } } },
    });

    expect(
      screen.getByRole("button", { name: "Auto mode settings: pause 1–3 min" }),
    ).toHaveTextContent("1–3 min");
  });

  it("sets the pause to whatever is typed in the settings", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { pause: { minS: 15, maxS: 45 } } },
    });

    await user.click(
      screen.getByRole("button", { name: /^Auto mode settings/ }),
    );
    const shortest = screen.getByLabelText("Shortest pause");
    const longest = screen.getByLabelText("Longest pause");
    expect(shortest).toHaveValue(15);
    expect(longest).toHaveValue(45);
    await user.clear(shortest);
    await user.type(shortest, "20");
    await user.clear(longest);
    await user.type(longest, "90");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      controller.actions.autoMode.setPause,
    ).toHaveBeenCalledExactlyOnceWith({ minS: 20, maxS: 90 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("won't save a shortest pause longer than the longest", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { pause: { minS: 15, maxS: 45 } } },
    });

    await user.click(
      screen.getByRole("button", { name: /^Auto mode settings/ }),
    );
    const shortest = screen.getByLabelText("Shortest pause");
    await user.clear(shortest);
    await user.type(shortest, "60");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("The shortest pause can't be longer than the longest"),
    ).toBeVisible();
    expect(shortest).toHaveClass("is-invalid");
    expect(controller.actions.autoMode.setPause).not.toHaveBeenCalled();

    await user.clear(shortest);
    await user.type(shortest, "30");
    expect(shortest).not.toHaveClass("is-invalid");
  });

  it("won't save a pause that isn't whole seconds", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />);

    await user.click(
      screen.getByRole("button", { name: /^Auto mode settings/ }),
    );
    const longest = screen.getByLabelText("Longest pause");
    await user.clear(longest);
    await user.type(longest, "2.5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Pauses are whole seconds, from 0 to 65535"),
    ).toBeVisible();
    expect(longest).toHaveClass("is-invalid");
    expect(screen.getByLabelText("Shortest pause")).not.toHaveClass(
      "is-invalid",
    );
    expect(controller.actions.autoMode.setPause).not.toHaveBeenCalled();
  });

  it("leaves the pause as it was when cancelled, and starts afresh", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<AutoModeControl />, {
      state: { autoMode: { pause: { minS: 15, maxS: 45 } } },
    });
    const settings = screen.getByRole("button", {
      name: /^Auto mode settings/,
    });

    await user.click(settings);
    await user.clear(screen.getByLabelText("Shortest pause"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(settings);

    expect(screen.getByLabelText("Shortest pause")).toHaveValue(15);
    expect(controller.actions.autoMode.setPause).not.toHaveBeenCalled();
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
