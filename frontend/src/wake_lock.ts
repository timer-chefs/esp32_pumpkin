import { useEffect, useState } from "react";

export type WakeLockStatus = "unsupported" | "inactive" | "active";

// Locking the phone (or letting the screen auto-dim to sleep) suspends the
// page and kills the WebSocket, which otherwise looks like the application
// just dying. Holding a screen wake lock is the direct fix. The lock is
// released by the browser whenever the tab is hidden, so it's re-acquired on
// every return to visibility (e.g. switching back from another app).
//
// The status is returned (rather than left as an internal detail) so the UI
// can surface whether the lock is actually held -- acquisition can silently
// fail (denied, unsupported browser, low battery mode on iOS, ...) and that's
// exactly the kind of thing that should be visible rather than discovered
// only when the socket drops again.
export function useKeepScreenAwake(): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>(() =>
    navigator.wakeLock ? "inactive" : "unsupported",
  );

  useEffect(() => {
    if (!navigator.wakeLock) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel = lock;
        setStatus("active");
        lock.addEventListener("release", () => {
          if (sentinel === lock) {
            sentinel = null;
            setStatus("inactive");
          }
        });
      } catch (error) {
        console.warn("Could not acquire screen wake lock:", error);
        setStatus("inactive");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void sentinel?.release();
      sentinel = null;
    };
  }, []);

  return status;
}
