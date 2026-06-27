#include "show_manager.h"

ShowManager::ShowManager(EffectManager& effect_manager)
    : effect_manager(effect_manager) {}

const Show* ShowManager::get_current_show() const
{
    return current_show_;
}

void ShowManager::play(const Show& show)
{
    current_show_ = &show;

    effect_manager.set_effect(show.effect);
    effect_manager.set_color(show.color);
}
