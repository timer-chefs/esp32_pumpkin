import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKeepScreenAwake } from "./wake_lock.ts";

describe("useKeepScreenAwake", () => {
  let release: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;
  let sentinels: EventTarget[];
  const originalWakeLock = (navigator as Navigator & { wakeLock?: WakeLock })
    .wakeLock;

  beforeEach(() => {
    sentinels = [];
    release = vi.fn().mockResolvedValue(undefined);
    request = vi.fn().mockImplementation(() => {
      const sentinel = new EventTarget();
      sentinels.push(sentinel);
      return Promise.resolve(
        Object.assign(sentinel, { release }) as unknown as WakeLockSentinel,
      );
    });
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "wakeLock", {
      value: originalWakeLock,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("requests a screen wake lock on mount and reports it active", async () => {
    const { result } = renderHook(() => useKeepScreenAwake());

    expect(request).toHaveBeenCalledWith("screen");
    await vi.waitFor(() => expect(result.current).toBe("active"));
  });

  it("releases the wake lock on unmount", async () => {
    const { result, unmount } = renderHook(() => useKeepScreenAwake());
    await vi.waitFor(() => expect(result.current).toBe("active"));

    unmount();

    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });

  it("reports inactive and re-acquires when the document becomes visible again", async () => {
    const { result } = renderHook(() => useKeepScreenAwake());
    await vi.waitFor(() => expect(result.current).toBe("active"));

    // The browser releases the sentinel itself as soon as the tab is hidden.
    sentinels[0].dispatchEvent(new Event("release"));
    await vi.waitFor(() => expect(result.current).toBe("inactive"));

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current).toBe("active"));
  });

  it("reports inactive when acquiring the lock is rejected", async () => {
    request.mockRejectedValueOnce(new Error("denied"));

    const { result } = renderHook(() => useKeepScreenAwake());

    await vi.waitFor(() => expect(result.current).toBe("inactive"));
  });

  it("reports unsupported and does nothing when the Wake Lock API is missing", () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => useKeepScreenAwake());

    expect(result.current).toBe("unsupported");
    expect(request).not.toHaveBeenCalled();
  });
});
