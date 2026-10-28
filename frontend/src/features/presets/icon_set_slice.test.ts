import { version as lucideVersion } from "lucide-react/package.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppAccess } from "../../app/slice.ts";
import {
  iconSetSlice,
  type IconSetState,
  lucideIcons,
} from "./icon_set_slice.ts";

function createIconSet() {
  let state: IconSetState = { ...iconSetSlice.initialState };
  const actions = iconSetSlice.createActions({
    getState: () => state,
    update: (partial) => {
      state = { ...state, ...partial };
    },
    app: {} as AppAccess,
  });
  return { actions, state: () => state };
}

function answer(response: Response | Error) {
  const fetch =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("iconSetSlice", () => {
  it("fetches the icons, keyed for React", async () => {
    answer(
      Response.json({
        cat: [
          ["path", { d: "M1 1" }],
          ["circle", { cx: "12", cy: "12", r: "2" }],
        ],
      }),
    );
    const { actions, state } = createIconSet();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().icons?.get("cat")).toEqual([
      ["path", { d: "M1 1", key: "0" }],
      ["circle", { cx: "12", cy: "12", r: "2", key: "1" }],
    ]);
  });

  it("fetches the icons only as their checksum says they should be", async () => {
    const fetch = answer(Response.json({}));
    const { actions, state } = createIconSet();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith(
      `https://cdn.jsdelivr.net/npm/lucide-static@${lucideIcons.version}/icon-nodes.json`,
      { integrity: lucideIcons.integrity },
    );
  });

  it("fetches the icons of the Lucide the page carries its own from", () => {
    // On upgrading lucide-react, the icons' version and checksum go with it.
    // The README says how to work out the checksum.
    expect(lucideIcons.version).toBe(lucideVersion);
  });

  it("says why the icons couldn't be fetched", async () => {
    answer(new TypeError("Failed to fetch"));
    const { actions, state } = createIconSet();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().icons).toBeNull();
    expect(state().error).toBe("Failed to fetch");
  });

  it("doesn't take an error page for the icons", async () => {
    answer(new Response("Not found", { status: 404 }));
    const { actions, state } = createIconSet();

    actions.load();

    await vi.waitFor(() => expect(state().isLoading).toBe(false));
    expect(state().icons).toBeNull();
    expect(state().error).toBe("jsDelivr answered 404");
  });
});
