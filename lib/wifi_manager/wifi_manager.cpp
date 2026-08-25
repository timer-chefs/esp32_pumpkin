#include "wifi_manager.h"
#include <WiFiManager.h>
#include <DNSServer.h>
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

static DNSServer redirect_dns;
static bool redirect_active = false;
static unsigned long redirect_start_time = 0;

static void setup_wm_ip_display()
{
    wm.setWebServerCallback([&]() {
        wm.server->on("/api/ip", HTTP_GET, []() {
            if(WiFi.status() == WL_CONNECTED)
            {
                wm.server->send(200, "text/plain", WiFi.localIP().toString());
            }
            else
            {
                wm.server->send(200, "text/plain", "");
            }
        });
    });

    wm.setCustomHeadElement(
        "<script>"
        "document.addEventListener('DOMContentLoaded',function(){"
        "  var t=setInterval(function(){"
        "    fetch('/api/ip').then(function(r){return r.text();})"
        "    .then(function(ip){"
        "      if(ip){"
        "        clearInterval(t);"
        "        var url='http://'+ip;"
        "        var d=document.createElement('div');"
        "        d.style.cssText='text-align:center;padding:1em;margin:1em 0;"
        "          background:#e8f5e9;border-radius:8px;';"
        "        d.innerHTML='<h2>Connected!</h2>"
        "          <p>Your pumpkin is at:</p>"
        "          <h2><a href=\"'+url+'\">'+url+'</a></h2>"
        "          <p>Redirecting in 5 seconds...</p>';"
        "        document.body.insertBefore(d,document.body.firstChild);"
        "        setTimeout(function(){window.location.href=url;},5000);"
        "      }"
        "    }).catch(function(){});"
        "  },2000);"
        "});"
        "</script>"
    );
}

static void IRAM_ATTR config_button_ISR() {
    wifi_config_requested = true;
}

void start_ip_info_portal(void)
{
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("Pumpkin-redirect");

    redirect_dns.start(53, "*", WiFi.softAPIP());
    redirect_active = true;
    redirect_start_time = millis();

    Serial.println("Redirect portal started on SoftAP");
}

void wifi_redirect_service()
{
    if(!redirect_active)
    {
        return;
    }

    redirect_dns.processNextRequest();

    if(millis() - redirect_start_time > ip_info_portal_timeout_ms)
    {
        wifi_redirect_stop();
    }
}

void wifi_redirect_stop()
{
    if(!redirect_active)
    {
        return;
    }

    redirect_active = false;
    redirect_dns.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);

    Serial.println("Redirect portal closed");
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

    setup_wm_ip_display();

    bool is_wifi_connected = wm.autoConnect(wifi_provisioning_ssid);
    if(!is_wifi_connected){
        Serial.println("WiFi failed to connect");
    }
    else{
        Serial.println("WiFi is connected");
        Serial.println(String("IP: ") + WiFi.localIP().toString());
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
                Serial.println(String("IP: ") + WiFi.localIP().toString());
            }

            web_interface_start();
            wifi_state = WiFiState::NORMAL;

    }
}
