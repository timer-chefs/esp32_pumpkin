import type {
  AudioSourceActions,
  AudioSourceState,
} from "../features/audio_source/audio_source_slice.ts";
import type {
  CalibrationActions,
  CalibrationState,
} from "../features/calibration/calibration_slice.ts";
import type { EyeActions, EyeState } from "../features/eye/eye_slice.ts";
import type {
  PresetsActions,
  PresetsState,
} from "../features/presets/presets_slice.ts";
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
  calibration: CalibrationState;
  eye: EyeState;
  presets: PresetsState;
  sdCard: SdCardState;
  status: StatusState;
  volume: VolumeState;
}

export interface AppActions {
  audioSource: AudioSourceActions;
  calibration: CalibrationActions;
  eye: EyeActions;
  presets: PresetsActions;
  sdCard: SdCardActions;
  status: StatusActions;
  volume: VolumeActions;
}
