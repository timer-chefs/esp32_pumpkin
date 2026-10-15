import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { SpeechButton } from "./SpeechButton.tsx";

describe("SpeechButton", () => {
  it("opens a form to type in", async () => {
    const user = userEvent.setup();
    renderWithAppContext(<SpeechButton />);

    await user.click(screen.getByRole("button", { name: "Type" }));

    expect(screen.getByRole("dialog", { name: "Say" })).toBeInTheDocument();
    expect(screen.getByLabelText("What to say")).toHaveFocus();
  });

  it("keeps what's typed after the form is closed", async () => {
    const user = userEvent.setup();
    renderWithAppContext(<SpeechButton />);

    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.type(screen.getByLabelText("What to say"), "Boo");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Type" }));

    expect(screen.getByLabelText("What to say")).toHaveValue("Boo");
  });
});
