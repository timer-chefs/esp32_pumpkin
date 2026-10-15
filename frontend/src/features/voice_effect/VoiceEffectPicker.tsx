import {
  Ghost,
  type LucideIcon,
  Skull,
  Speech,
  WandSparkles,
} from "lucide-react";
import { ToggleButton, ToggleButtonGroup } from "react-bootstrap";

import { effects } from "./effects.ts";
import { useVoiceEffect } from "./voice_effect_slice.ts";
import "./voice_effect.css";

const effectIcons: Record<string, LucideIcon> = {
  demon: Skull,
  ghost: Ghost,
  witch: WandSparkles,
};

export function VoiceEffectPicker() {
  const { effectId, select } = useVoiceEffect();

  return (
    <section className="control-section" aria-labelledby="voice-effect-heading">
      <div className="section-heading">
        <h2 id="voice-effect-heading">Voice effect</h2>
        <span className="text-body-secondary">For talking and saying</span>
      </div>

      <ToggleButtonGroup
        type="radio"
        name="voice-effect"
        aria-labelledby="voice-effect-heading"
        className="voice-effects"
        value={effectId}
        onChange={select}
      >
        {effects.map((effect) => {
          const Icon = effectIcons[effect.id] ?? Speech;
          return (
            <ToggleButton
              key={effect.id}
              id={`voice-effect-${effect.id}`}
              value={effect.id}
              variant="outline-dark"
            >
              <Icon aria-hidden="true" />
              {effect.name}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </section>
  );
}
