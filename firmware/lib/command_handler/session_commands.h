#ifndef SESSION_COMMANDS_H
#define SESSION_COMMANDS_H

#include "effect_manager.h"
#include "pumpkin_generated.h"

// The commands that coordinate more than one subsystem -- starting and
// stopping playback, and the show and volume that go with it. Commands that
// belong to a single feature are registered by that feature instead.
void register_session_commands();

// The effect a client means by `light_effect`. Returns false for one this
// firmware doesn't have.
bool find_effect(Pumpkin::Protocol::LightEffectId light_effect, EffectId& effect);

#endif //SESSION_COMMANDS_H
