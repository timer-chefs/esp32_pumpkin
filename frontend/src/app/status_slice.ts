import { useAppContext } from "./app_context.tsx";
import type { Slice } from "./slice.ts";

/** The one-line summary of what the device is doing, shown in the header. */
export interface StatusState {
  mode: string;
  streaming: string | null;
}

export interface StatusActions {
  set: (status: Partial<StatusState>) => void;
}

export const statusSlice: Slice<StatusState, StatusActions> = {
  initialState: { mode: "Idle", streaming: null },
  createActions: ({ update }) => ({
    set: (status) => update(status),
  }),
};

export function useAppStatus(): StatusState {
  return useAppContext().state.status;
}
