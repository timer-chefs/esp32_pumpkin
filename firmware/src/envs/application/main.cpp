#include <Arduino.h>
#include <ESPmDNS.h>

#include "config.h"
#include "device_log.h"
#include "audio.h"
#include "led_strip.h"
#include "web_interface.h"
#include "show_manager.h"
#include "command_handler.h"
#include "eye_commands.h"
#include "preset_shows.h"
#include "sd_audio.h"
#include "sd_card.h"
#include "sd_upload.h"
#include "wifi_manager.h"

bool is_audio_ready = false;

EffectManager effect_manager;
ShowManager show_manager(effect_manager);
Eye eye;

void setup()
{
    Serial.begin(baud_rate);

    led_strip_init();

    eye.begin();

    command_handler_init();
    register_eye_commands(eye);

    sd_card_init();
    sd_audio_init();

    wifi_manager_init();

    if (!MDNS.begin(mdns_hostname))
    {
        device_log.println("mDNS failed");
    }
    else
    {
        device_log.println(String("mDNS: http://") + mdns_hostname + ".local");
        MDNS.addService("http", "tcp", web_server_port);
    }

    web_interface_init();
    web_interface_start();

    is_audio_ready = audio_init();
    if(!is_audio_ready)
    {
        device_log.println("Audio init failed");
    }

    verify_registered_commands();

    device_log.println("System ready");
}

void loop()
{
    wifi_manager_service();

    web_interface_service();
    
    sd_upload_service();

    if(is_audio_ready)
    {
        sd_audio_service();
        if(sd_audio_take_playback_finished())
        {
            show_manager.set_current_show(0);
        }

        audio_service();
        effect_manager.update(led_strip, num_leds);
        FastLED.show();
    }
}
