import { ButtonGroup } from "react-bootstrap";

import { PushToTalkButton } from "../features/audio_source/PushToTalkButton.tsx";
import { SpeechButton } from "../features/speech/SpeechButton.tsx";
import { VoiceEffectPicker } from "../features/voice_effect/VoiceEffectPicker.tsx";
import "./voice_controls.css";

/**
 * The ways to give the pumpkin a voice -- typed or talked -- side by side
 * with the effect that both are said in.
 */
export function VoiceControls() {
  return (
    <section className="control-section">
      <ButtonGroup className="voice-controls" aria-label="Voice">
        <SpeechButton />
        <VoiceEffectPicker />
        <PushToTalkButton />
      </ButtonGroup>
    </section>
  );
}
