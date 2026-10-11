import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Button, Spinner } from "react-bootstrap";

import { usePage } from "../../app/page.ts";
import { useLog } from "./log_slice.ts";
import "./log.css";

// Scrolled to within this of the end counts as following the log, which is
// when new lines scroll into view.
const FOLLOW_THRESHOLD_PX = 24;

export function DeviceLog() {
  const { entries, isConnected, isConnecting, setVisible, reconnect, clear } =
    useLog();
  const isVisible = usePage() === "log";
  const logRef = useRef<HTMLDivElement>(null);
  const isFollowing = useRef(true);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  // Keeps the newest line in view while following, including once the page
  // is shown again: the log has no size to scroll while it is hidden.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && isFollowing.current) {
      log.scrollTop = log.scrollHeight;
    }
  }, [entries, isVisible]);

  return (
    <section className="control-section" aria-labelledby="log-heading">
      <div className="section-heading">
        <h2 id="log-heading">Device log</h2>
        <span className="text-body-secondary">
          {isConnected ? "Live" : "Not connected"}
        </span>
      </div>

      <div
        ref={logRef}
        className="device-log"
        role="log"
        aria-labelledby="log-heading"
        tabIndex={0}
        onScroll={(event) => {
          const log = event.currentTarget;
          isFollowing.current =
            log.scrollHeight - log.scrollTop - log.clientHeight <=
            FOLLOW_THRESHOLD_PX;
        }}
      >
        {entries.length === 0 ? (
          <p className="device-log-empty">Nothing logged yet</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`device-log-entry device-log-entry--${entry.kind}`}
            >
              {entry.text}
            </div>
          ))
        )}
      </div>

      <div className="device-log-actions">
        {!isConnected && (
          <Button
            variant="outline-dark"
            className="icon-label-button"
            disabled={isConnecting}
            onClick={reconnect}
          >
            {isConnecting ? (
              <Spinner animation="border" size="sm" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Reconnect
          </Button>
        )}
        <Button
          variant="outline-dark"
          className="icon-label-button"
          disabled={entries.length === 0}
          onClick={clear}
        >
          <Trash2 aria-hidden="true" />
          Clear
        </Button>
      </div>
    </section>
  );
}
