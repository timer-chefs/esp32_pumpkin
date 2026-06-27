#ifndef SHOW_MANGER_H
#define SHOW_MANAGER_H

#include "effect_manager.h"
#include "show.h"

class ShowManager
{
public:
    explicit ShowManager(EffectManager& effect_manager);
    void play(const Show& show);

    const Show* get_current_show() const;

private:
    EffectManager& effect_manager;
    const Show* current_show_ = nullptr;
};

#endif //SHOW_MANAGER_H
