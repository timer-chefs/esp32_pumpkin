#include "wifi_manager.h"
#include <WiFiManager.h>
#include "config.h"
#include "web_interface.h"

enum class WiFiState
{
    NORMAL,
    PROVISIONING
};

static WiFiState wifi_state = WiFiState::NORMAL;
static volatile bool wifi_config_requested = false;

static WiFiManager wm;

static void IRAM_ATTR config_button_ISR() {
    wifi_config_requested = true;
}

void wifi_manager_init() {
    pinMode(pin_wifi_provisioning_btn, INPUT_PULLUP);

    attachInterrupt(
        digitalPinToInterrupt(pin_wifi_provisioning_btn),
        config_button_ISR,
        FALLING
    );

    WiFi.mode(WIFI_STA);

    bool is_wifi_connected = wm.autoConnect(wifi_provisioning_ssid);
    if(!is_wifi_connected){
        Serial.println("WiFi failed to connect");
    }
    else{
        Serial.println("WiFi is connected");
    }
}

void wifi_provisioning_service(){
    switch(wifi_state){
        case WiFiState::NORMAL:
            if(wifi_config_requested){
                wifi_config_requested = false;
                wifi_state = WiFiState::PROVISIONING;
            }
            break;
        
        case WiFiState::PROVISIONING:
            Serial.println("WiFi provisioning requested");

            web_interface_stop();

            wm.setConfigPortalTimeout(wifi_provisioning_timeout);
       
            bool is_wifi_connected = wm.startConfigPortal(wifi_provisioning_ssid);

            if(!is_wifi_connected){
                Serial.println("WiFi failed to connect and hit timout");
                ESP.restart();
            }
            else{
                Serial.println("WiFi connected");
            }

            web_interface_start();
            wifi_state = WiFiState::NORMAL;
            
    }
}
