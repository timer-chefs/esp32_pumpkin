import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AppState } from "../../app/app_state.ts";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { SdCardFileList } from "./SdCardFileList.tsx";

function renderList(sdCard: Partial<AppState["sdCard"]> = {}) {
  return renderWithAppContext(<SdCardFileList />, { state: { sdCard } })
    .controller;
}

describe("SdCardFileList", () => {
  it("lists the files on the card and plays the chosen one", async () => {
    const user = userEvent.setup();
    const controller = renderList({
      files: [
        { name: "ghost.wav", size: 1_048_576 },
        { name: "howl.wav", size: 524_288 },
      ],
    });

    expect(screen.getByText("ghost.wav")).toBeVisible();
    expect(screen.getByText("1.00 MB")).toBeVisible();

    await user.click(screen.getAllByRole("button", { name: "Play" })[1]);

    expect(controller.actions.sdCard.playFile).toHaveBeenCalledWith("howl.wav");
  });

  it("marks the file that is playing and can stop it", async () => {
    const user = userEvent.setup();
    const controller = renderList({
      playingFile: "ghost.wav",
      files: [{ name: "ghost.wav", size: 1024 }],
    });

    expect(screen.getByLabelText("Playing")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(controller.actions.sdCard.stopPlayback).toHaveBeenCalledOnce();
  });

  it("keeps stopping unavailable while nothing is playing", () => {
    renderList({ files: [{ name: "ghost.wav", size: 1024 }] });

    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
  });

  it("reports an empty card", () => {
    renderList({ files: [] });

    expect(screen.getByText("No audio files on the SD card")).toBeVisible();
  });

  it("surfaces a listing failure and can retry it", async () => {
    const user = userEvent.setup();
    const controller = renderList({ error: "Could not read the SD card" });

    expect(screen.getByText("Could not read the SD card")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(controller.actions.sdCard.refresh).toHaveBeenCalledOnce();
  });
});
