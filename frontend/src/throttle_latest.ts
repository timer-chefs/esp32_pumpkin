/**
 * Wraps `send` so it runs at most once per `intervalMs`. The first call goes
 * out straight away; calls inside the interval only replace the value that
 * goes out when it ends. Meant for a control being dragged, where every
 * value in between is stale by the time the next one arrives but the one it
 * comes to rest on must not be lost.
 */
export function throttleLatest<Value>(
  intervalMs: number,
  send: (value: Value) => void,
): (value: Value) => void {
  let lastSentAt = -Infinity;
  let pending: { value: Value } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending) {
      return;
    }

    const { value } = pending;
    pending = null;
    lastSentAt = Date.now();
    send(value);
  };

  return (value) => {
    pending = { value };
    if (timer) {
      return;
    }

    const wait = lastSentAt + intervalMs - Date.now();
    if (wait <= 0) {
      flush();
    } else {
      timer = setTimeout(flush, wait);
    }
  };
}
