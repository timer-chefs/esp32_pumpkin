import { LightEffectId } from "../../generated/pumpkin/protocol.ts";
import type { LightScene } from "../../pumpkin_client.ts";

/**
 * How the pumpkin lights up while it talks, whether live or saying
 * something typed: the candles' orange, flaring with the voice. The device
 * lights the candles again once it stops.
 */
export const voiceLight: LightScene = {
  effect: LightEffectId.AUDIO_REACTIVE,
  color: "#ffa500",
};
