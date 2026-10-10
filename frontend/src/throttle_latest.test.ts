import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { throttleLatest } from "./throttle_latest.ts";

describe("throttleLatest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the first value straight away", () => {
    const send = vi.fn();
    throttleLatest(50, send)(1);

    expect(send).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("sends only the latest of the values inside an interval, once it ends", () => {
    const send = vi.fn();
    const throttled = throttleLatest(50, send);

    throttled(1);
    throttled(2);
    throttled(3);
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(3);
  });

  it("sends straight away again once the interval has passed", () => {
    const send = vi.fn();
    const throttled = throttleLatest(50, send);

    throttled(1);
    vi.advanceTimersByTime(60);
    throttled(2);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(2);
  });
});
