import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AppState } from "../app_controller.ts";
import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { AudioSourceControl } from "./AudioSourceControl.tsx";

function renderControl(state: Partial<AppState> = {}) {
  return renderWithAppContext(<AudioSourceControl />, { state }).controller;
}

describe("AudioSourceControl", () => {
  it("delegates source selection", async () => {
    const user = userEvent.setup();
    const controller = renderControl();

    await user.click(screen.getByRole("button", { name: "Microphone" }));
    await user.click(screen.getByRole("button", { name: "Audio file" }));

    expect(controller.actions.startMicrophone).toHaveBeenCalledOnce();
    expect(controller.actions.startFileMode).toHaveBeenCalledOnce();
  });

  it("accepts a file and exposes file streaming controls", async () => {
    const user = userEvent.setup();
    const controller = renderControl({
      activeSource: "file",
      fileStatus: { message: "Selected: song.wav", tone: "neutral" },
      streamFileEnabled: true,
    });
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    await user.upload(screen.getByLabelText("Audio file"), file);
    await user.click(screen.getByRole("button", { name: "Stream" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(controller.actions.selectAudioFile).toHaveBeenCalledWith(file);
    expect(controller.actions.startFile).toHaveBeenCalledOnce();
    expect(controller.actions.stopAudio).toHaveBeenCalledOnce();
    expect(screen.getByText("Selected: song.wav")).toBeVisible();
  });

  it("shows the microphone state and delegates stopping", async () => {
    const user = userEvent.setup();
    const controller = renderControl({
      activeSource: "microphone",
      microphoneStatus: "streaming",
    });

    expect(screen.getByText("Microphone streaming")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(controller.actions.stopMicrophone).toHaveBeenCalledOnce();
  });

  it("shows microphone startup before streaming begins", () => {
    renderControl({
      activeSource: "microphone",
      microphoneStatus: "starting",
    });

    expect(screen.getByText("Starting microphone")).toBeVisible();
    expect(screen.queryByText("Microphone streaming")).not.toBeInTheDocument();
  });
});
