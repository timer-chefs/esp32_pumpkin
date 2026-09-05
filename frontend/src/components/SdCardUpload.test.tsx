import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AppState } from "../app_controller.ts";
import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { SdCardUpload } from "./SdCardUpload.tsx";

function renderUpload(state: Partial<AppState> = {}) {
  return renderWithAppContext(<SdCardUpload />, { state }).controller;
}

describe("SdCardUpload", () => {
  it("uploads the chosen song", async () => {
    const user = userEvent.setup();
    const controller = renderUpload();
    const file = new File(["audio"], "howl.mp3", { type: "audio/mpeg" });

    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();

    await user.upload(screen.getByLabelText("Song to upload"), file);
    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(controller.actions.uploadToSdCard).toHaveBeenCalledWith(file);
  });

  it("reports the measured rate and what is left of the transfer", () => {
    renderUpload({
      upload: {
        name: "howl.wav",
        phase: "sending",
        bytesSent: 250_000,
        totalBytes: 1_000_000,
        bytesPerSecond: 102_400,
        secondsRemaining: 90,
      },
    });

    expect(screen.getByText("howl.wav")).toBeVisible();
    expect(screen.getByText("25% - 100 kB/s - 1m 30s left")).toBeVisible();
  });

  it("says so while the song is still being converted", () => {
    renderUpload({
      upload: {
        name: "howl.wav",
        phase: "converting",
        bytesSent: 0,
        totalBytes: 0,
        bytesPerSecond: null,
        secondsRemaining: null,
      },
    });

    expect(screen.getByText("Converting...")).toBeVisible();
  });

  it("can cancel an upload in progress", async () => {
    const user = userEvent.setup();
    const controller = renderUpload({
      upload: {
        name: "howl.wav",
        phase: "sending",
        bytesSent: 1024,
        totalBytes: 8192,
        bytesPerSecond: null,
        secondsRemaining: null,
      },
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(controller.actions.cancelUpload).toHaveBeenCalledOnce();
  });
});
