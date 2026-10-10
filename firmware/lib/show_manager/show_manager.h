#ifndef SHOW_MANAGER_H
#define SHOW_MANAGER_H

#include "effect_manager.h"
#include "show.h"

class ShowManager
{
public:
    explicit ShowManager(EffectManager& effect_manager);
    void set_current_show(uint16_t show_id);

    // Lights the pumpkin without going through a show, for a client that
    // says exactly what it wants. Leaves no show current.
    void set_light(EffectId effect, const CRGB& color);

    const Show* get_current_show() const;

private:
    EffectManager& effect_manager;
    const Show* current_show = nullptr;
    const Show* find_show(uint16_t show_id) const;
};

#endif //SHOW_MANAGER_H
