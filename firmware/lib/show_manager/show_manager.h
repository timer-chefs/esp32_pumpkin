#ifndef SHOW_MANAGER_H
#define SHOW_MANAGER_H

#include "effect_manager.h"
#include "show.h"

class ShowManager
{
public:
    explicit ShowManager(EffectManager& effect_manager);
    void set_current_show(uint16_t show_id);

    const Show* get_current_show() const;

private:
    EffectManager& effect_manager;
    const Show* current_show = nullptr;
    const Show* find_show(uint16_t show_id) const;
};

#endif //SHOW_MANAGER_H
