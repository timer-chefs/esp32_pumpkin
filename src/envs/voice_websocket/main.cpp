#include <Arduino.h>
#include <ESPmDNS.h>

#include "config.h"
#include "audio.h"
#include "led_strip.h"
#include "web_interface.h"
#include "show_manager.h"
#include "command_handler.h"
#include "preset_shows.h"
#include "wifi_manager.h"

bool is_audio_ready = false;

EffectManager effect_manager;
ShowManager show_manager(effect_manager);
CommandHandler command_handler(show_manager);

void setup()
{
    Serial.begin(baud_rate);

    led_strip_init();

    wifi_manager_init();

    if (!MDNS.begin(mdns_hostname))
    {
        Serial.println("mDNS failed");
    }
    else
    {
        Serial.println(String("mDNS: http://") + mdns_hostname + ".local");
        MDNS.addService("http", "tcp", web_server_port);
    }

    web_interface_init();
    web_interface_start();
    start_ip_info_portal();

    is_audio_ready = audio_init();
    if(!is_audio_ready)
    {
        Serial.println("Audio init failed");
    }

    Serial.println("System ready");
}

void loop()
{
    wifi_provisioning_handling();
    wifi_redirect_service();

    web_interface_service();
    
    if(is_audio_ready)
    {
        audio_service();
        effect_manager.update(led_strip, num_leds);
        FastLED.show();
    }
}
