import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { DeviceLog } from "./DeviceLog.tsx";
import type { LogEntry } from "./log_slice.ts";

const entries: LogEntry[] = [
  { id: 1, kind: "line", text: "System ready" },
  { id: 2, kind: "restart", text: "The pumpkin restarted" },
  { id: 3, kind: "line", text: "Show ID: 2" },
];

afterEach(() => {
  location.hash = "";
});

describe("DeviceLog", () => {
  it("tells the log when its page is open", () => {
    location.hash = "#log";
    const { controller } = renderWithAppContext(<DeviceLog />);

    expect(controller.actions.log.setVisible).toHaveBeenCalledExactlyOnceWith(
      true,
    );
  });

  it("tells the log when another page is open", () => {
    location.hash = "#presets";
    const { controller } = renderWithAppContext(<DeviceLog />);

    expect(controller.actions.log.setVisible).toHaveBeenCalledExactlyOnceWith(
      false,
    );
  });

  it("shows what the pumpkin has logged, in order", () => {
    renderWithAppContext(<DeviceLog />, {
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

  it("shows when each line was logged", () => {
    renderWithAppContext(<DeviceLog />, {
      state: {
        log: {
          entries: [
            { id: 1, kind: "line", uptime: "0:02:14.37", text: "Show ID: 2" },
          ],
        },
      },
    });

    expect(screen.getByRole("log")).toHaveTextContent("0:02:14.37 Show ID: 2");
    expect(screen.getByText("0:02:14.37")).toHaveClass("device-log-uptime");
  });

  it("says when nothing has been logged yet", () => {
    renderWithAppContext(<DeviceLog />, {
      state: { log: { isConnected: true } },
    });

    expect(screen.getByText("Nothing logged yet")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("clears the log", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<DeviceLog />, {
      state: { log: { entries, isConnected: true } },
    });

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(controller.actions.log.clear).toHaveBeenCalledOnce();
  });

  it("offers to reconnect while not connected", async () => {
    const user = userEvent.setup();
    const { controller } = renderWithAppContext(<DeviceLog />, {
      state: { log: { entries, isConnected: false } },
    });

    expect(screen.getByText("Not connected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reconnect" }));

    expect(controller.actions.log.reconnect).toHaveBeenCalledOnce();
  });

  it("has no need to reconnect while connected", () => {
    renderWithAppContext(<DeviceLog />, {
      state: { log: { entries, isConnected: true } },
    });

    expect(
      screen.queryByRole("button", { name: "Reconnect" }),
    ).not.toBeInTheDocument();
  });

  it("holds off reconnecting while it already is", () => {
    renderWithAppContext(<DeviceLog />, {
      state: { log: { isConnected: false, isConnecting: true } },
    });

    expect(screen.getByRole("button", { name: "Reconnect" })).toBeDisabled();
  });
});
