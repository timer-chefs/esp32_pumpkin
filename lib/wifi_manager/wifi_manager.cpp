#include "wifi_manager.h"
#include <WiFiManager.h>
#include <DNSServer.h>
#include <WebServer.h>
#include "config.h"
#include "web_interface.h"

enum class WiFiState
{
    NORMAL,
    PROVISIONING
};

static WiFiState wifi_state = WiFiState::NORMAL;
volatile bool wifi_config_request = false;

static WiFiManager wm;

static void IRAM_ATTR config_button_ISR() {
    wifi_config_request = true;
}

static void start_ip_info_portal()
{
    IPAddress station_ip = WiFi.localIP();

    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(wifi_provisioning_ssid);

    DNSServer dns_server;
    WebServer info_server(80);

    dns_server.start(53, "*", WiFi.softAPIP());

    String page = "<!DOCTYPE html><html><head>"
                  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<style>body{font-family:sans-serif;text-align:center;padding:2em;}"
                  "h2{color:#333;}a{font-size:1.5em;}</style></head><body>"
                  "<h1>Pumpkin</h1>"
                  "<p>Connected! Your pumpkin is at:</p>"
                  "<h2>http://" + station_ip.toString() + "</h2>"
                  "<p>Connect to your hotspot and navigate to this address.</p>"
                  "</body></html>";

    bool page_visited = false;

    info_server.on("/", [&]() {
        info_server.send(200, "text/html", page);
        page_visited = true;
    });

    info_server.onNotFound([&]() {
        info_server.send(204);
    });

    info_server.begin();

    Serial.println("IP info portal started on SoftAP");

    unsigned long start_time = millis();

    while(!page_visited && (millis() - start_time < ip_info_portal_timeout_ms))
    {
        dns_server.processNextRequest();
        info_server.handleClient();
        delay(1);
    }

    if(page_visited)
    {
        unsigned long render_end = millis() + 3000;
        while(millis() < render_end)
        {
            info_server.handleClient();
            delay(1);
        }
    }

    info_server.stop();
    dns_server.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);

    Serial.println("IP info portal closed");
}

void wifi_manager_init() {
    pinMode(pin_wifi_provisioning_btn, INPUT_PULLUP);

    attachInterrupt(
        digitalPinToInterrupt(pin_wifi_provisioning_btn),
        config_button_ISR,
        FALLING
    );

    WiFi.mode(WIFI_STA);
    WiFi.setHostname(mdns_hostname);

    bool is_wifi_connected = wm.autoConnect(wifi_provisioning_ssid);
    if(!is_wifi_connected){
        Serial.println("WiFi fail to connect");
    }
    else{
        Serial.println("WiFi is connected");
        Serial.println(String("IP: ") + WiFi.localIP().toString());
        start_ip_info_portal();
    }
}

void wifi_provisioning_handling(){
    switch(wifi_state){
        case WiFiState::NORMAL:
            if(wifi_config_request){
                wifi_config_request = false;
                wifi_state = WiFiState::PROVISIONING;
            }
            break;

        case WiFiState::PROVISIONING:
            Serial.println("WiFi provisioning requested");

            web_interface_stop();

            wm.setConfigPortalTimeout(wifi_provisioning_timeout);

            bool is_wifi_connected = wm.startConfigPortal(wifi_provisioning_ssid);

            if(!is_wifi_connected){
                Serial.println("WiFi fail to connect and hit timout");
                delay(3000);
                ESP.restart();
            }
            else{
                Serial.println("WiFi connected");
                Serial.println(String("IP: ") + WiFi.localIP().toString());
                start_ip_info_portal();
            }

            web_interface_start();
            wifi_state = WiFiState::NORMAL;

    }
}
