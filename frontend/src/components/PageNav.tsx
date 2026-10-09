import { Nav } from "react-bootstrap";

import type { Page } from "../app/page.ts";

const titles: Record<Page, string> = {
  presets: "Presets",
  audio: "Audio",
  calibration: "Calibration",
};

export function PageNav({ page }: { page: Page }) {
  return (
    <Nav variant="underline" className="page-nav" activeKey={page}>
      {Object.entries(titles).map(([key, title]) => (
        <Nav.Item key={key}>
          <Nav.Link eventKey={key} href={`#${key}`}>
            {title}
          </Nav.Link>
        </Nav.Item>
      ))}
    </Nav>
  );
}
