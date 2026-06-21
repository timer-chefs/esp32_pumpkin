#include "web_interface.h"

#include "audio.h"
#include "config.h"

#include <WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>

static WebServer server(web_server_port);
static WebSocketsServer webSocket(web_socket_port);

static void filesystem_init()
{
    if(!LittleFS.begin())
    {
        Serial.println("LittleFS Mount Failed");
        return;
    }
}

static void open_file(const char* path, const char* content_type)
{
    if(!LittleFS.exists(path))
    {
        server.send(404, "text/plain", "File not found");
        return;
    }

    File file = LittleFS.open(path, "r");
    if(!file)
    {
        server.send(500, "text/plain", "Failed to open file");
        return;
    }

    server.streamFile(file, content_type);
    file.close();
}

static void handle_root_request()
{
    open_file("/index.html", "text/html");
}

static void handle_css_request()
{
    open_file("/styles.css", "text/css");
}

static void handle_js_request()
{
    open_file("/main.js", "application/javascript");
}

static void handle_audio_file_utils_request()
{
    open_file("/audio_file_utils.js", "application/javascript");
}

static void handle_worklet_processor()
{
    open_file("/worklet_processor.js", "application/javascript");
}

static void handle_audio_ui_request()
{
    open_file("/audio_ui.js", "application/javascript");
}

static void handle_audio_socket_request()
{
    open_file("/audio_socket.js", "application/javascript");
}

static void handle_audio_state_request()
{
    open_file("/audio_state.js", "application/javascript");
}

static void handle_microphone_controller_request()
{
    open_file("/microphone_controller.js", "application/javascript");
}

static void handle_audio_cleanup_request()
{
    open_file("/audio_cleanup.js", "application/javascript");
}

static void handle_audio_file_controller_request()
{
    open_file("/audio_file_controller.js", "application/javascript");
}

static void handle_audio_file_processor_request()
{
    open_file("/audio_file_processor.js", "application/javascript");
}

static void handle_audio_streamer_request()
{
    open_file("/audio_streamer.js", "application/javascript");
}

static void handle_audio_volume_control_request()
{
    open_file("/audio_volume_control.js", "application/javascript");
}

static void web_socket_event(
    uint8_t client_num,
    WStype_t type,
    uint8_t* payload,
    size_t length)
{
    (void)client_num;
    switch(type) {
        case WStype_CONNECTED:
            Serial.println("Client connected");
            break;
        case WStype_DISCONNECTED:
            Serial.println("Client disconnected");
            break;

        case WStype_BIN:
            audio_write(payload, length);
            break;

        default:
            break;
    }
}

static void handle_audio_reset()
{
    audio_reset();
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
    
    server.on("/", HTTP_GET, handle_root_request);
    server.on("/styles.css", HTTP_GET, handle_css_request);
    server.on("/main.js", HTTP_GET, handle_js_request);
    server.on("/audio_file_utils.js", HTTP_GET, handle_audio_file_utils_request);
    server.on("/audio_ui.js", HTTP_GET, handle_audio_ui_request);
    server.on("/api/audio/reset", HTTP_GET, handle_audio_reset);
    server.on("/api/audio/volume/up", HTTP_POST, handle_volume_up);
    server.on("/api/audio/volume/down", HTTP_POST, handle_volume_down);
    server.on("/api/audio/volume", HTTP_GET, handle_get_volume);
    server.on("/worklet_processor.js", HTTP_GET, handle_worklet_processor);
    server.on("/audio_socket.js", HTTP_GET, handle_audio_socket_request);
    server.on("/audio_state.js", HTTP_GET, handle_audio_state_request);
    server.on("/microphone_controller.js", HTTP_GET, handle_microphone_controller_request);
    server.on("/audio_cleanup.js", HTTP_GET, handle_audio_cleanup_request);
    server.on("/audio_file_controller.js", HTTP_GET, handle_audio_file_controller_request);
    server.on("/audio_file_processor.js", HTTP_GET, handle_audio_file_processor_request);
    server.on("/audio_streamer.js", HTTP_GET, handle_audio_streamer_request);
    server.on("/audio_volume_control.js", HTTP_GET, handle_audio_volume_control_request);
    server.begin();

    webSocket.onEvent(web_socket_event);
    webSocket.begin();
    
    Serial.println("Web interface initialized");
}

void web_interface_service() {
    server.handleClient();
    webSocket.loop();
}
