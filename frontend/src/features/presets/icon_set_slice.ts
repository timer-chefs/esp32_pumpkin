import type { IconNode } from "lucide-react";
import { version as lucideVersion } from "lucide-react/package.json";

import { useSlice } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import { toError } from "../../to_error.ts";

// Lucide's icons, all of them, from jsDelivr: too many to fit in flash with
// the rest of the page. jsDelivr marks a version's files as never changing,
// so the browser's own cache keeps them after the first time.

/** Every icon by its Lucide name. */
export type IconSet = Map<string, IconNode>;

export interface IconSetState {
  /** Null until they've been fetched, and if they can't be. */
  icons: IconSet | null;
  isLoading: boolean;
  /** Why they couldn't be fetched. The page still has the icons it carries. */
  error: string | null;
}

export interface IconSetActions {
  load: () => void;
}

// The version of Lucide the page was built with, so these draw just like the
// icons it carries.
const iconsUrl = `https://cdn.jsdelivr.net/npm/lucide-static@${lucideVersion}/icon-nodes.json`;

export const iconSetSlice: Slice<IconSetState, IconSetActions> = {
  initialState: { icons: null, isLoading: false, error: null },
  createActions: ({ update }) => ({
    load: () =>
      runAction(async () => {
        update({ isLoading: true, error: null });
        try {
          const response = await fetch(iconsUrl);
          if (!response.ok) {
            throw new Error(`jsDelivr answered ${response.status}`);
          }
          update({ icons: readIconSet(await response.json()) });
        } catch (error) {
          console.warn("Could not fetch the icons:", error);
          update({ error: toError(error).message });
        } finally {
          update({ isLoading: false });
        }
      }),
  }),
};

/** The file as Lucide publishes it: every icon's elements, without keys. */
function readIconSet(icons: Record<string, IconNode>): IconSet {
  // React wants a key on each of an icon's elements, which the file leaves
  // out to save the room.
  return new Map(
    Object.entries(icons).map(([name, elements]) => [
      name,
      elements.map(([element, attributes], index) => [
        element,
        { ...attributes, key: String(index) },
      ]),
    ]),
  );
}

export function useIconSet() {
  return useSlice("iconSet");
}
