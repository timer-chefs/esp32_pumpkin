import { useEffect, useSyncExternalStore } from "react";

import { audioSourceSlice } from "../features/audio_source/audio_source_slice.ts";
import { calibrationSlice } from "../features/calibration/calibration_slice.ts";
import { eyeSlice } from "../features/eye/eye_slice.ts";
import { logSlice } from "../features/log/log_slice.ts";
import { presetsSlice } from "../features/presets/presets_slice.ts";
import { sdCardSlice } from "../features/sd_card/sd_card_slice.ts";
import { speechSlice } from "../features/speech/speech_slice.ts";
import { voiceEffectSlice } from "../features/voice_effect/voice_effect_slice.ts";
import { volumeSlice } from "../features/volume/volume_slice.ts";
import {
  getPumpkinConnection,
  type PumpkinConnection,
} from "../pumpkin_connection.ts";
import type { AppActions, AppState } from "./app_state.ts";
import { statusSlice } from "./status_slice.ts";
import type { AppAccess, Slice, SliceContext } from "./slice.ts";

// The whole feature list. Everything else about a feature lives in its own
// directory; this is the only place that has to know it exists.
const slices: {
  [Name in keyof AppState]: Slice<AppState[Name], AppActions[Name]>;
} = {
  audioSource: audioSourceSlice,
  calibration: calibrationSlice,
  eye: eyeSlice,
  log: logSlice,
  presets: presetsSlice,
  sdCard: sdCardSlice,
  speech: speechSlice,
  status: statusSlice,
  voiceEffect: voiceEffectSlice,
  volume: volumeSlice,
};

export interface AppController {
  state: AppState;
  actions: AppActions;
}

const listeners = new Set<() => void>();

// Iterating the slice list loses the pairing between a name and its slice
// that the type of `slices` already guarantees, so composing it back into
// AppState/AppActions is where the casts are.
type AnySlice = Slice<object, object>;
type AnySliceContext = SliceContext<object>;

let state = Object.fromEntries(
  Object.entries(slices).map(([name, slice]) => [
    name,
    (slice as unknown as AnySlice).initialState,
  ]),
) as unknown as AppState;

const app: AppAccess = {
  getState: () => state,
  actions: () => actions,
  connection: getOpenConnection,
};

function contextFor<Name extends keyof AppState>(
  name: Name,
): SliceContext<AppState[Name]> {
  return {
    getState: () => state[name],
    update: (partial) => {
      state = { ...state, [name]: { ...state[name], ...partial } };
      listeners.forEach((listener) => listener());
    },
    app,
  };
}

export const actions = Object.fromEntries(
  Object.entries(slices).map(([name, slice]) => [
    name,
    (slice as unknown as AnySlice).createActions(
      contextFor(name as keyof AppState) as unknown as AnySliceContext,
    ),
  ]),
) as unknown as AppActions;

export const initialState = state;

export function useAppController(): AppController {
  const currentState = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    const connection = getPumpkinConnection(location.hostname);
    actions.volume.load();
    return actions.log.listen(connection);
  }, []);

  return { state: currentState, actions };
}

function getState(): AppState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function getOpenConnection(): Promise<PumpkinConnection> {
  const connection = getPumpkinConnection(location.hostname);
  await connection.waitUntilOpen();
  return connection;
}
