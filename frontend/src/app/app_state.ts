import type {
  AudioSourceActions,
  AudioSourceState,
} from "../features/audio_source/audio_source_slice.ts";
import type {
  AutoModeActions,
  AutoModeState,
} from "../features/auto_mode/auto_mode_slice.ts";
import type {
  CalibrationActions,
  CalibrationState,
} from "../features/calibration/calibration_slice.ts";
import type { EyeActions, EyeState } from "../features/eye/eye_slice.ts";
import type {
  IconSetActions,
  IconSetState,
} from "../features/presets/icon_set_slice.ts";
import type { LogActions, LogState } from "../features/log/log_slice.ts";
import type {
  PresetsActions,
  PresetsState,
} from "../features/presets/presets_slice.ts";
import type {
  SdCardActions,
  SdCardState,
} from "../features/sd_card/sd_card_slice.ts";
import type {
  SpeechActions,
  SpeechState,
} from "../features/speech/speech_slice.ts";
import type {
  VoiceEffectActions,
  VoiceEffectState,
} from "../features/voice_effect/voice_effect_slice.ts";
import type {
  VolumeActions,
  VolumeState,
} from "../features/volume/volume_slice.ts";
import type { StatusActions, StatusState } from "./status_slice.ts";

// Adding a feature is one line in each of these, and one in the slice list
// the controller composes. Nothing else has to learn about it.

export interface AppState {
  audioSource: AudioSourceState;
  autoMode: AutoModeState;
  calibration: CalibrationState;
  eye: EyeState;
  iconSet: IconSetState;
  log: LogState;
  presets: PresetsState;
  sdCard: SdCardState;
  speech: SpeechState;
  status: StatusState;
  voiceEffect: VoiceEffectState;
  volume: VolumeState;
}

export interface AppActions {
  audioSource: AudioSourceActions;
  autoMode: AutoModeActions;
  calibration: CalibrationActions;
  eye: EyeActions;
  iconSet: IconSetActions;
  log: LogActions;
  presets: PresetsActions;
  sdCard: SdCardActions;
  speech: SpeechActions;
  status: StatusActions;
  voiceEffect: VoiceEffectActions;
  volume: VolumeActions;
}
