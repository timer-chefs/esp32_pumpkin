#include <Arduino.h>

#include "config.h"
#include "audio.h"
#include "web_interface.h"

#include <WiFi.h>

void setup()
{
    Serial.begin(baud_rate);

    WiFi.softAP(ssid);
    WiFi.setSleep(false);

    IPAddress web_page_ip_address = WiFi.softAPIP();
    Serial.println(web_page_ip_address);

    web_interface_init();

    bool is_audio_ready = audio_init();
    Serial.println(is_audio_ready ? "Audio ready" : "Audio init failed");

    Serial.println("System ready");
}

void loop()
{
    web_interface_loop();
    audioLoop();
}
