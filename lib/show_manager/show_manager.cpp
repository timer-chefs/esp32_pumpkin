#include "show_manager.h"
#include "preset_shows.h"

#include "esp_log.h"

static const char* tag = "show_manager";

ShowManager::ShowManager(EffectManager& effect_manager)
    : effect_manager(effect_manager) {}

const Show* ShowManager::get_current_show() const
{
    return current_show;
}

void ShowManager::set_current_show(uint16_t show_id)
{
    ESP_LOGI(tag, "Show ID: %u", show_id);
    const Show* show = find_show(show_id);
    if(show == nullptr)
    {
        ESP_LOGW(tag, "Unknown show: %u", show_id);
        return;
    }
    current_show = show;

    effect_manager.set_effect(current_show->effect);
    effect_manager.set_color(current_show->color);
}

const Show* ShowManager::find_show(uint16_t show_id) const
{
    for(size_t i = 0; i < preset_show_count; ++i)
    {
        if(preset_shows[i].id == show_id)
        {
            return &preset_shows[i];
        }
    }

    return nullptr;
}
