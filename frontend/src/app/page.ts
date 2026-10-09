import { useSyncExternalStore } from "react";

/** The pages there are, the first being where the app opens. */
export const pages = ["presets", "audio", "calibration"] as const;

export type Page = (typeof pages)[number];

/**
 * The page the URL's hash names, so a page can be bookmarked and the back
 * button moves between them.
 */
export function usePage(): Page {
  return useSyncExternalStore(subscribe, readPage, () => pages[0]);
}

function readPage(): Page {
  const hash = location.hash.slice(1);
  return pages.find((page) => page === hash) ?? pages[0];
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
