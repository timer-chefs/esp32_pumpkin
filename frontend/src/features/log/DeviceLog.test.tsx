import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { DeviceLog } from "./DeviceLog.tsx";
import type { LogEntry } from "./log_slice.ts";

const entries: LogEntry[] = [
  { id: 1, kind: "line", text: "System ready" },
  { id: 2, kind: "restart", text: "The pumpkin restarted" },
  { id: 3, kind: "line", text: "Show ID: 2" },
];

describe("DeviceLog", () => {
  it("tells the log when its page is open", () => {
    const { controller } = renderWithAppContext(<DeviceLog isVisible />);

    expect(controller.actions.log.setVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    );
  });

  it("tells the log when another page is open", () => {
    const { controller } = renderWithAppContext(
      <DeviceLog isVisible={false} />,
    );

    expect(controller.actions.log.setVisible).toHaveBeenCalledExactlyOnceWith(
      false,
    );
  });

  it("shows what the pumpkin has logged, in order", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { entries, isConnected: true } },
    });

    const log = screen.getByRole("log", { name: "Device log" });
    expect(log).toHaveTextContent(
      "System readyThe pumpkin restartedShow ID: 2",
    );
    expect(within(log).getByText("The pumpkin restarted")).toHaveClass(
      "device-log-entry--restart",
    );
    expect(screen.getByText("Live")).toBeVisible();
  });

  it("shows the time of day each line was logged", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: {
        log: {
          entries: [
            {
              id: 1,
              kind: "line",
              uptime: "0:02:14.37",
              loggedAt: new Date(2026, 9, 11, 9, 5, 7, 370).getTime(),
              text: "Show ID: 2",
            },
          ],
        },
      },
    });

    expect(screen.getByRole("log")).toHaveTextContent("09:05:07.37 Show ID: 2");
    expect(screen.getByText("09:05:07.37")).toHaveAttribute(
      "title",
      "0:02:14.37 after the pumpkin started",
    );
  });

  it("shows how long the pumpkin had run when the time of day isn't known", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: {
        log: {
          entries: [
            { id: 1, kind: "line", uptime: "0:02:14.37", text: "Show ID: 2" },
          ],
        },
      },
    });

    expect(screen.getByRole("log")).toHaveTextContent("0:02:14.37 Show ID: 2");
  });

  it("says when nothing has been logged yet", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { isConnected: true } },
    });

    expect(screen.getByText("Nothing logged yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("clears the log", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { entries, isConnected: true } },
    });

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(controller.actions.log.clear).toHaveBeenCalledOnce();
  });

  it("offers to reconnect while not connected", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { entries, isConnected: false } },
    });

    expect(screen.getByText("Not connected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reconnect" }));

    expect(controller.actions.log.reconnect).toHaveBeenCalledOnce();
  });

  it("has no need to reconnect while connected", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { entries, isConnected: true } },
    });

    expect(
      screen.queryByRole("button", { name: "Reconnect" }),
    ).not.toBeInTheDocument();
  });

  it("holds off reconnecting while it already is", () => {
    renderWithAppContext(<DeviceLog isVisible />, {
      state: { log: { isConnected: false, isConnecting: true } },
    });

    expect(screen.getByRole("button", { name: "Reconnect" })).toBeDisabled();
  });
});
