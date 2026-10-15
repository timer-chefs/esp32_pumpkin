import {
  ChevronDown,
  Ghost,
  type LucideIcon,
  Skull,
  Speech,
  WandSparkles,
} from "lucide-react";
import { ButtonGroup, Dropdown } from "react-bootstrap";

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
  const picked = effects.find((effect) => effect.id === effectId) ?? effects[0];
  const PickedIcon = effectIcons[picked.id] ?? Speech;

  return (
    <Dropdown as={ButtonGroup} onSelect={(id) => id !== null && select(id)}>
      <Dropdown.Toggle
        id="voice-effect-toggle"
        variant="dark"
        className="voice-side-button voice-effect-toggle"
        aria-label={`Voice effect: ${picked.name}`}
      >
        <PickedIcon aria-hidden="true" />
        <span className="voice-effect-name">
          {picked.name}
          <ChevronDown aria-hidden="true" />
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu className="voice-effect-menu">
        {effects.map((effect) => {
          const Icon = effectIcons[effect.id] ?? Speech;
          return (
            <Dropdown.Item
              key={effect.id}
              as="button"
              eventKey={effect.id}
              active={effect.id === effectId}
              className="voice-effect-item"
            >
              <Icon aria-hidden="true" />
              {effect.name}
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
}
