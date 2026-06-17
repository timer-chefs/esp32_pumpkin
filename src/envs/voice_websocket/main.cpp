#include <Arduino.h>

#include "config.h"
#include "audio.h"
#include "web_interface.h"

#include <WiFi.h>

bool is_audio_ready = false;

void setup()
{
    Serial.begin(baud_rate);

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
    }
    
}
