#include <Arduino.h>

#include "config.h"
#include "audio.h"
#include "led_strip.h"
#include "web_interface.h"

#include <WiFi.h>

bool is_audio_ready = false;

void setup()
{
    Serial.begin(baud_rate);

    led_strip_init();

    WiFi.softAP(ssid);
    WiFi.setSleep(false);

    IPAddress web_page_ip_address = WiFi.softAPIP();
    Serial.println(web_page_ip_address);

    web_interface_init();

    is_audio_ready = audio_init();
    if(!is_audio_ready)
    {
        Serial.println("Audio init failed");
    }

    Serial.println("System ready");
}

void loop()
{
    web_interface_service();
    if(is_audio_ready)
    {
        audio_service();
        led_strip_service(is_audio_running(), CRGB::White);
    }
}
