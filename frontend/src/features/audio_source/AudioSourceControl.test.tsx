import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AppState } from "../../app/app_state.ts";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { AudioSourceControl } from "./AudioSourceControl.tsx";

type StateOverrides = { [Name in keyof AppState]?: Partial<AppState[Name]> };

function renderControl(state: StateOverrides = {}) {
  return renderWithAppContext(<AudioSourceControl />, { state }).controller;
}

describe("AudioSourceControl", () => {
  it("delegates source selection", async () => {
    const user = userEvent.setup();
    const controller = renderControl();

    await user.click(screen.getByRole("button", { name: "Microphone" }));
    await user.click(screen.getByRole("button", { name: "Audio file" }));
    await user.click(screen.getByRole("button", { name: "SD card" }));

    expect(
      controller.actions.audioSource.startMicrophone,
    ).toHaveBeenCalledOnce();
    expect(controller.actions.audioSource.startFileMode).toHaveBeenCalledOnce();
    expect(
      controller.actions.audioSource.startSdCardMode,
    ).toHaveBeenCalledOnce();
  });

  it("shows the SD card listing when the card is the active source", () => {
    renderControl({
      audioSource: { active: "sdCard" },
      sdCard: { files: [{ name: "ghost.wav", size: 1024 }] },
    });

    expect(screen.getByText("Files on the SD card")).toBeVisible();
    expect(screen.getByText("ghost.wav")).toBeVisible();
  });

  it("accepts a file and exposes file streaming controls", async () => {
    const user = userEvent.setup();
    const controller = renderControl({
      audioSource: {
        active: "file",
        fileStatus: { message: "Selected: song.wav", tone: "neutral" },
        streamFileEnabled: true,
      },
    });
    const file = new File(["audio"], "song.wav", { type: "audio/wav" });

    await user.upload(screen.getByLabelText("Audio file"), file);
    await user.click(screen.getByRole("button", { name: "Stream" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(controller.actions.audioSource.selectFile).toHaveBeenCalledWith(
      file,
    );
    expect(controller.actions.audioSource.startFile).toHaveBeenCalledOnce();
    expect(controller.actions.audioSource.stopAudio).toHaveBeenCalledOnce();
    expect(screen.getByText("Selected: song.wav")).toBeVisible();
  });

  it("shows the microphone state and delegates stopping", async () => {
    const user = userEvent.setup();
    const controller = renderControl({
      audioSource: { active: "microphone", microphoneStatus: "streaming" },
    });

    expect(screen.getByText("Microphone streaming")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(
      controller.actions.audioSource.stopMicrophone,
    ).toHaveBeenCalledOnce();
  });

  it("shows microphone startup before streaming begins", () => {
    renderControl({
      audioSource: { active: "microphone", microphoneStatus: "starting" },
    });

    expect(screen.getByText("Starting microphone")).toBeVisible();
    expect(screen.queryByText("Microphone streaming")).not.toBeInTheDocument();
  });
});
