import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { PushToTalkButton } from "./PushToTalkButton.tsx";

describe("PushToTalkButton", () => {
  beforeAll(() => {
    // jsdom doesn't implement pointer capture.
    HTMLElement.prototype.setPointerCapture ??= () => {};
  });

  it("talks only while the button is held", () => {
    const { controller } = renderWithAppContext(<PushToTalkButton />);
    const button = screen.getByRole("button", { name: "Hold to talk" });

    fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
    expect(controller.actions.audioSource.pressToTalk).toHaveBeenCalledOnce();
    expect(controller.actions.audioSource.releaseToTalk).not.toHaveBeenCalled();

    fireEvent.pointerUp(button, { button: 0, pointerId: 1 });
    expect(controller.actions.audioSource.releaseToTalk).toHaveBeenCalled();
  });

  it("ignores presses with anything but the main button", () => {
    const { controller } = renderWithAppContext(<PushToTalkButton />);

    fireEvent.pointerDown(screen.getByRole("button"), {
      button: 2,
      pointerId: 1,
    });

    expect(controller.actions.audioSource.pressToTalk).not.toHaveBeenCalled();
  });

  it("can be held from the keyboard", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<PushToTalkButton />);

    screen.getByRole("button").focus();
    await user.keyboard("[Space>]");
    expect(controller.actions.audioSource.pressToTalk).toHaveBeenCalledOnce();
    expect(controller.actions.audioSource.releaseToTalk).not.toHaveBeenCalled();

    await user.keyboard("[/Space]");
    expect(controller.actions.audioSource.releaseToTalk).toHaveBeenCalled();
  });

  it("shows that it is live while talking", () => {
    renderWithAppContext(<PushToTalkButton />, {
      state: { audioSource: { pushToTalk: "talking" } },
    });

    expect(screen.getByRole("button", { name: "Talking" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
