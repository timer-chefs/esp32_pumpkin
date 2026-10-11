import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../test/render_with_app_context.tsx";
import { PageNav } from "./PageNav.tsx";

describe("PageNav", () => {
  it("counts the log lines that arrived since the log was last open", () => {
    renderWithAppContext(<PageNav page="presets" />, {
      state: { log: { unread: 7 } },
    });

    expect(screen.getByRole("link", { name: "Log 7 new lines" })).toBeVisible();
  });

  it("shows no count when there's nothing new", () => {
    renderWithAppContext(<PageNav page="presets" />);

    expect(screen.getByRole("link", { name: "Log" })).toBeVisible();
  });

  it("only says there are a lot past 99", () => {
    renderWithAppContext(<PageNav page="presets" />, {
      state: { log: { unread: 250 } },
    });

    expect(
      screen.getByRole("link", { name: "Log 99+ new lines" }),
    ).toBeVisible();
  });
});
