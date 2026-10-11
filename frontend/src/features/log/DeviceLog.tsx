import { RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Button, Spinner } from "react-bootstrap";

import { useLog } from "./log_slice.ts";
import "./log.css";

// Scrolled to within this of the end counts as following the log, which is
// when new lines scroll into view.
const FOLLOW_THRESHOLD_PX = 24;

export interface DeviceLogProps {
  /**
   * Whether the page the log is on is shown. It has to come from whatever
   * hides the page, in the same render: the log has no size to scroll while
   * it is hidden.
   */
  isVisible: boolean;
}

export function DeviceLog({ isVisible }: DeviceLogProps) {
  const { entries, isConnected, isConnecting, setVisible, reconnect, clear } =
    useLog();
  const logRef = useRef<HTMLDivElement>(null);
  const isFollowing = useRef(true);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  // Opening the page shows the newest line, wherever the log was scrolled
  // to before...
  useLayoutEffect(() => {
    if (isVisible) {
      isFollowing.current = true;
    }
  }, [isVisible]);

  // ...and new lines scroll into view for as long as it stays there.
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
              {entry.uptime && (
                <>
                  <span className="device-log-uptime">{entry.uptime}</span>{" "}
                </>
              )}
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
