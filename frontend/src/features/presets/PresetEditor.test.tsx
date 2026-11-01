import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppContextProvider } from "../../app/app_context.tsx";
import { renderWithAppContext } from "../../test/render_with_app_context.tsx";
import { testPresets } from "../../test/test_presets.ts";
import { PresetEditor } from "./PresetEditor.tsx";
import type { PresetsState } from "./presets_slice.ts";

const [ghost, scream, wolf] = testPresets;

function renderEditing(presets: Partial<PresetsState> = {}) {
  return renderWithAppContext(<PresetEditor />, {
    state: {
      presets: {
        presets: [ghost, scream, wolf],
        draft: [ghost, scream, wolf],
        ...presets,
      },
      sdCard: { files: [{ name: "ghost.wav", size: 1 }] },
    },
  });
}

describe("PresetEditor", () => {
  it("stays out of the way while the presets aren't being edited", () => {
    renderWithAppContext(<PresetEditor />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists the presets being edited, in order", () => {
    renderEditing();

    const dialog = screen.getByRole("dialog", { name: "Edit presets" });
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      "Ghostghost.wav",
      "Screamscream.wav isn't on the SD card",
      "Wolfwolf.wav isn't on the SD card",
    ]);
  });

  it("opens a preset in the form, and goes back to the list", async () => {
    const user = userEvent.setup();
    renderEditing();

    await user.click(screen.getByRole("button", { name: "Change Scream" }));

    expect(screen.getByRole("dialog", { name: "Edit preset" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Scream");

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("dialog", { name: "Edit presets" })).toBeVisible();
  });

  it("changes the open preset as it is edited", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Change Wolf" }));
    await user.type(screen.getByLabelText("Name"), "!");

    expect(controller.actions.presets.change).toHaveBeenCalledWith(wolf.id, {
      name: "Wolf!",
    });
  });

  it("puts the open preset back as it was on Cancel", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();
    const { id, ...asItWas } = wolf;

    await user.click(screen.getByRole("button", { name: "Change Wolf" }));
    await user.type(screen.getByLabelText("Name"), "!");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(controller.actions.presets.change).toHaveBeenLastCalledWith(
      id,
      asItWas,
    );
    expect(screen.getByRole("dialog", { name: "Edit presets" })).toBeVisible();
  });

  it("takes a preset that was only just added away again on Cancel", async () => {
    const user = userEvent.setup();
    const { controller, rerender } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Add preset" }));
    const [added] = vi.mocked(controller.actions.presets.add).mock.calls[0];
    rerender(
      <AppContextProvider
        value={{
          ...controller,
          state: {
            ...controller.state,
            presets: { ...controller.state.presets, draft: [ghost, added] },
          },
        }}
      >
        <PresetEditor />
      </AppContextProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(controller.actions.presets.remove).toHaveBeenCalledExactlyOnceWith(
      added.id,
    );
    expect(controller.actions.presets.change).not.toHaveBeenCalled();
  });

  it("tries out and deletes the open preset", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Change Wolf" }));
    await user.click(screen.getByRole("button", { name: "Try" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete Wolf?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    expect(controller.actions.presets.tryOut).toHaveBeenCalledExactlyOnceWith(
      wolf.id,
    );
    expect(controller.actions.presets.remove).toHaveBeenCalledExactlyOnceWith(
      wolf.id,
    );
    expect(screen.getByRole("dialog", { name: "Edit presets" })).toBeVisible();
  });

  it("adds a preset", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Add preset" }));

    expect(controller.actions.presets.add).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "New preset" }),
    );
  });

  it("marks the presets that have been changed or added", () => {
    const added = { ...wolf, id: "added", name: "Bats" };
    renderEditing({ draft: [ghost, { ...scream, sound: null }, wolf, added] });

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.className.match(/is-\w+/)?.[0])).toEqual([
      undefined,
      "is-changed",
      undefined,
      "is-new",
    ]);
    expect(within(rows[1]).getByText("Changed")).toBeVisible();
    expect(within(rows[3]).getByText("New")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Change Scream (changed)" }),
    ).toBeVisible();
  });

  it("doesn't mark a preset that was changed and changed back", () => {
    renderEditing({ draft: [{ ...ghost }, scream, wolf] });

    expect(screen.queryByText("Changed")).toBeNull();
  });

  it("makes Save stand out only once there's something to save", () => {
    const { unmount } = renderEditing();
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "btn-outline-dark",
    );
    unmount();

    // Taking one away, or putting them in another order, is a change too.
    for (const draft of [
      [ghost, scream],
      [scream, ghost, wolf],
    ]) {
      const { unmount } = renderEditing({ draft });
      expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
        "btn-dark",
      );
      unmount();
    }
  });

  it("moves a preset up and down", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Move Scream up" }));
    await user.click(screen.getByRole("button", { name: "Move Scream down" }));

    expect(controller.actions.presets.move).toHaveBeenNthCalledWith(
      1,
      scream.id,
      -1,
    );
    expect(controller.actions.presets.move).toHaveBeenNthCalledWith(
      2,
      scream.id,
      1,
    );
  });

  it("can't move the first preset up or the last one down", () => {
    renderEditing();

    expect(
      screen.getByRole("button", { name: "Move Ghost up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Wolf down" }),
    ).toBeDisabled();
  });

  it("deletes a preset once that's been confirmed", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Delete Wolf" }));

    const question = screen.getByRole("dialog", { name: "Delete Wolf?" });
    expect(controller.actions.presets.remove).not.toHaveBeenCalled();

    await user.click(within(question).getByRole("button", { name: "Delete" }));

    expect(controller.actions.presets.remove).toHaveBeenCalledExactlyOnceWith(
      wolf.id,
    );
    expect(screen.queryByRole("dialog", { name: "Delete Wolf?" })).toBeNull();
  });

  it("keeps a preset when deleting it is called off", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Delete Wolf" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(controller.actions.presets.remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Delete Wolf?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit presets" })).toBeVisible();
  });

  it("saves on Save and gives up the edits on Cancel", async () => {
    const user = userEvent.setup();
    const { controller } = renderEditing();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(controller.actions.presets.finishEditing).toHaveBeenCalledOnce();
    expect(controller.actions.presets.cancelEditing).toHaveBeenCalledOnce();
  });

  it("holds still while saving", () => {
    renderEditing({ isSaving: true });

    const dialog = screen.getByRole("dialog");
    for (const button of within(dialog).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(
      within(dialog).getByRole("button", { name: "Saving" }),
    ).toBeVisible();
  });

  it("says when there are no presets left", () => {
    renderEditing({ draft: [] });

    expect(screen.getByText("No presets")).toBeVisible();
  });

  it("reports presets that couldn't be saved", () => {
    renderEditing({ error: "Could not save the presets: No SD card detected" });

    expect(
      screen.getByText("Could not save the presets: No SD card detected"),
    ).toBeVisible();
  });
});
