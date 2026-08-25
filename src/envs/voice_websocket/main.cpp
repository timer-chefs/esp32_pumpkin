#include "esp_log.h"
#include "mdns.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "config.h"
#include "audio.h"
#include "pumpkin_led_strip.h"
#include "web_interface.h"
#include "show_manager.h"
#include "command_handler.h"
#include "preset_shows.h"
#include "wifi_manager.h"

static const char* tag = "pumpkin";

EffectManager effect_manager;
ShowManager show_manager(effect_manager);
CommandHandler command_handler(show_manager);

extern "C" void app_main()
{
    led_strip_init();

    wifi_manager_init();

    if(mdns_init() != ESP_OK)
    {
        ESP_LOGE(tag, "mDNS failed");
    }
    else
    {
        mdns_hostname_set(mdns_hostname);
        mdns_instance_name_set("Pumpkin");
        mdns_service_add(nullptr, "_http", "_tcp", web_server_port, nullptr, 0);
        ESP_LOGI(tag, "mDNS: http://%s.local", mdns_hostname);
    }

    web_interface_init();
    web_interface_start();

    const bool is_audio_ready = audio_init();
    if(!is_audio_ready)
    {
        ESP_LOGE(tag, "Audio init failed");
    }

    ESP_LOGI(tag, "System ready");

    while(true)
    {
        wifi_provisioning_handling();
        wifi_redirect_service();
        web_interface_service();

        if(is_audio_ready)
        {
            audio_service();
            effect_manager.update(led_strip, num_leds);
            led_strip_show();
        }

        vTaskDelay(pdMS_TO_TICKS(1));
    }
}
