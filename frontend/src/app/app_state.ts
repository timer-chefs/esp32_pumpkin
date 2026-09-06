import type {
  AudioSourceActions,
  AudioSourceState,
} from "../features/audio_source/audio_source_slice.ts";
import type {
  PresetShowsActions,
  PresetShowsState,
} from "../features/preset_shows/preset_shows_slice.ts";
import type {
  SdCardActions,
  SdCardState,
} from "../features/sd_card/sd_card_slice.ts";
import type {
  VolumeActions,
  VolumeState,
} from "../features/volume/volume_slice.ts";
import type { StatusActions, StatusState } from "./status_slice.ts";

// Adding a feature is one line in each of these, and one in the slice list
// the controller composes. Nothing else has to learn about it.

export interface AppState {
  audioSource: AudioSourceState;
  presetShows: PresetShowsState;
  sdCard: SdCardState;
  status: StatusState;
  volume: VolumeState;
}

export interface AppActions {
  audioSource: AudioSourceActions;
  presetShows: PresetShowsActions;
  sdCard: SdCardActions;
  status: StatusActions;
  volume: VolumeActions;
}
