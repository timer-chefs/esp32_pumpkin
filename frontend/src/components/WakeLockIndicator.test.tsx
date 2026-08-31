import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WakeLockIndicator } from "./WakeLockIndicator.tsx";

describe("WakeLockIndicator", () => {
  const originalWakeLock = (navigator as Navigator & { wakeLock?: WakeLock })
    .wakeLock;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "wakeLock", {
      value: originalWakeLock,
      configurable: true,
    });
  });

  it("shows an active label once the lock is held", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: vi
          .fn()
          .mockResolvedValue({ addEventListener: vi.fn(), release: vi.fn() }),
      },
      configurable: true,
    });

    render(<WakeLockIndicator />);

    expect(
      await screen.findByTitle("Screen will stay awake"),
    ).toBeInTheDocument();
  });

  it("shows an unsupported label when the API is missing", () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      configurable: true,
    });

    render(<WakeLockIndicator />);

    expect(
      screen.getByTitle("Screen may sleep (not supported by this browser)"),
    ).toBeInTheDocument();
  });
});
