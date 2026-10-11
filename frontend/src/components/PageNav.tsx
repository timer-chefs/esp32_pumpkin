import { Badge, Nav } from "react-bootstrap";

import type { Page } from "../app/page.ts";
import { useLog } from "../features/log/log_slice.ts";

const titles: Record<Page, string> = {
  presets: "Presets",
  audio: "Audio",
  calibration: "Calibration",
  log: "Log",
};

/** Past this, a count only says that there are a lot. */
const MAX_SHOWN_COUNT = 99;

export function PageNav({ page }: { page: Page }) {
  // What's new on a page since it was last open.
  const counts: Partial<Record<Page, { count: number; label: string }>> = {
    log: { count: useLog().unread, label: "new lines" },
  };

  return (
    <Nav variant="underline" className="page-nav" activeKey={page}>
      {Object.entries(titles).map(([key, title]) => {
        const count = counts[key as Page];
        return (
          <Nav.Item key={key}>
            <Nav.Link eventKey={key} href={`#${key}`}>
              {title}
              {count && count.count > 0 && (
                <>
                  {" "}
                  <Badge
                    pill
                    bg="warning"
                    text="dark"
                    className="page-nav-count"
                  >
                    {count.count > MAX_SHOWN_COUNT
                      ? `${MAX_SHOWN_COUNT}+`
                      : count.count}{" "}
                    <span className="visually-hidden">{count.label}</span>
                  </Badge>
                </>
              )}
            </Nav.Link>
          </Nav.Item>
        );
      })}
    </Nav>
  );
}
