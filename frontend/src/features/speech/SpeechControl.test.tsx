import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { flushSync } from "react-dom";
import { describe, expect, it, vi } from "vitest";

import { AppContextProvider } from "../../app/app_context.tsx";
import { actions, initialState } from "../../app/app_controller.ts";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { SpeechControl } from "./SpeechControl.tsx";
import type { SpeechPhase } from "./speech_slice.ts";

const MEGABYTE = 1024 * 1024;

describe("SpeechControl", () => {
  it("says what's typed", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<SpeechControl />);

    await user.type(screen.getByLabelText("What to say"), "I can see you");
    await user.click(screen.getByRole("button", { name: "Say" }));

    expect(controller.actions.speech.say).toHaveBeenCalledExactlyOnceWith(
      "I can see you",
    );
  });

  it("says it on Enter, but starts a new line on Shift+Enter", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<SpeechControl />);

    await user.type(
      screen.getByLabelText("What to say"),
      "Who{Shift>}{Enter}{/Shift}goes there?{Enter}",
    );

    expect(controller.actions.speech.say).toHaveBeenCalledExactlyOnceWith(
      "Who\ngoes there?",
    );
  });

  it("has nothing to say until something is typed", async () => {
    const user = userEvent.setup();
    renderWithAppContext(<SpeechControl />);

    await user.type(screen.getByLabelText("What to say"), "   ");

    expect(screen.getByRole("button", { name: "Say" })).toBeDisabled();
  });

  it("speaks with the voice that's picked", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<SpeechControl />);

    await user.selectOptions(screen.getByLabelText("Voice"), "Alan (British)");

    expect(
      controller.actions.speech.selectVoice,
    ).toHaveBeenCalledExactlyOnceWith("en_GB-alan-low");
  });

  it("says it with the effect that's picked", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<SpeechControl />);

    expect(screen.getByRole("radio", { name: "Demon" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Ghost" }));

    expect(
      controller.actions.speech.selectEffect,
    ).toHaveBeenCalledExactlyOnceWith("ghost", expect.anything());
  });

  it("shows how far the voice has downloaded", () => {
    renderWithAppContext(<SpeechControl />, {
      state: {
        speech: {
          phase: "loading",
          download: { loaded: 30 * MEGABYTE, total: 60 * MEGABYTE },
        },
      },
    });

    expect(screen.getByText(/30 of 60 MB/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByLabelText("Voice")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Witch" })).toBeDisabled();
  });

  it("stops without the click going on to say it again", async () => {
    const user = userEvent.setup();
    const say = vi.fn();
    render(<SpeakingSpeechControl say={say} />);

    await user.type(screen.getByLabelText("What to say"), "Boo");
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(screen.getByRole("button", { name: "Say" })).toBeInTheDocument();
    expect(say).not.toHaveBeenCalled();
  });

  it("shows what went wrong", () => {
    renderWithAppContext(<SpeechControl />, {
      state: { speech: { error: "Could not say it: network error" } },
    });

    expect(
      screen.getByText("Could not say it: network error"),
    ).toBeInTheDocument();
  });
});

/**
 * Speaking until it's stopped, as the real slice would be. A real click lets
 * React redraw before the button does what it's for, but one that's
 * dispatched from a test doesn't, so stopping redraws straight away.
 */
function SpeakingSpeechControl({ say }: { say: (text: string) => void }) {
  const [phase, setPhase] = useState<SpeechPhase | null>("speaking");
  const stop = () => flushSync(() => setPhase(null));
  const controller = {
    state: { ...initialState, speech: { ...initialState.speech, phase } },
    actions: {
      ...actions,
      speech: { selectVoice: vi.fn(), selectEffect: vi.fn(), say, stop },
    },
  };

  return (
    <AppContextProvider value={controller}>
      <SpeechControl />
    </AppContextProvider>
  );
}
