import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { VoiceEffectPicker } from "./VoiceEffectPicker.tsx";

describe("VoiceEffectPicker", () => {
  it("starts out as a demon", () => {
    renderWithAppContext(<VoiceEffectPicker />);

    expect(
      screen.getByRole("button", { name: "Voice effect: Demon" }),
    ).toBeInTheDocument();
  });

  it("shows the effect that's picked", () => {
    renderWithAppContext(<VoiceEffectPicker />, {
      state: { voiceEffect: { effectId: "witch" } },
    });

    expect(
      screen.getByRole("button", { name: "Voice effect: Witch" }),
    ).toBeInTheDocument();
  });

  it("picks the effect that's clicked", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<VoiceEffectPicker />);

    await user.click(screen.getByRole("button", { name: /Voice effect/ }));
    await user.click(screen.getByRole("button", { name: "Ghost" }));

    expect(
      controller.actions.voiceEffect.select,
    ).toHaveBeenCalledExactlyOnceWith("ghost");
  });
});
