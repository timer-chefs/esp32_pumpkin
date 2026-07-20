#include "web_interface.h"

#include "audio.h"
#include "config.h"
#include "command_handler.h"

#include <WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

static WebServer server(web_server_port);
static WebSocketsServer webSocket(web_socket_port);

extern CommandHandler command_handler;

static void filesystem_init()
{
    if(!LittleFS.begin())
    {
        Serial.println("LittleFS Mount Failed");
        return;
    }
}

static void web_socket_event(uint8_t client_num, WStype_t type, 
    uint8_t* payload, size_t length)
{
    (void)client_num;       //This is to indicate that client_num is not used.
    
    switch(type)
    {
        case WStype_CONNECTED:
        {
            Serial.println("Client connected");
            break;
        }

        case WStype_DISCONNECTED:
        {
            Serial.println("Client disconnected");
            break;
        }
        

        case WStype_TEXT:
        {
            JsonDocument doc;
            DeserializationError error =
                deserializeJson(doc, payload, length);

            if(error)
            {
                Serial.println("Invalid JSON");
                break;
            }

            command_handler.handle(doc);

            break;
        }

        case WStype_BIN:
        {
            audio_write(payload, length);
            break;
        }
        

        default:
            break;
    }
}

static void handle_audio_reset()
{
    audio_stoped();
    server.send(200, "application/json", "{\"status\":\"reset\"}");
}

static void handle_volume_up()
{
    float volume = get_volume();

    volume += 0.1f;
    if(volume > 1.0f)
    {
        volume = 1.0f;
    }

    set_volume(volume);

    server.send(200, "application/json", String("{\"volume\":") + volume + "}");
}

static void handle_volume_down()
{
    float volume = get_volume();

    volume -= 0.1f;
    if(volume < 0.0f)
    {
        volume = 0.0f;
    }

    set_volume(volume);

    server.send(
        200,
        "application/json",
        String("{\"volume\":") + volume + "}");
}

static void handle_get_volume()
{
    float volume = get_volume();

    server.send(
        200,
        "application/json",
        String("{\"volume\":") + volume + "}");
}
void web_interface_init()
{
    filesystem_init();

    //Serve commands:
    server.on("/api/audio/reset", HTTP_GET, handle_audio_reset);
    server.on("/api/audio/volume/up", HTTP_POST, handle_volume_up);
    server.on("/api/audio/volume/down", HTTP_POST, handle_volume_down);
    server.on("/api/audio/volume", HTTP_GET, handle_get_volume);

    //Serve static files from LittleFS:
    server.serveStatic("/", LittleFS, "/index.html");
    server.serveStatic("/", LittleFS, "/", NULL);

    server.begin();

    webSocket.onEvent(web_socket_event);
    webSocket.begin();
    
    Serial.println("Web interface initialized");
}

void web_interface_service() {
    server.handleClient();
    webSocket.loop();
}
