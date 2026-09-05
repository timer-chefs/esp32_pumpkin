#include "web_interface.h"

#include "audio.h"
#include "config.h"
#include "command_handler.h"
#include "sd_audio.h"

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <vector>
#include <flatbuffers/flatbuffers.h>
#include "pumpkin_generated.h"

static WebServer server(web_server_port);
static WebSocketsServer webSocket(web_socket_port);

extern CommandHandler command_handler;
static uint16_t connected_clients = 0;

using namespace Pumpkin::Protocol;

static void filesystem_init()
{
    if(!LittleFS.begin())
    {
        Serial.println("LittleFS Mount Failed");
        return;
    }
}

static void send_response(
    uint8_t client_num,
    uint32_t request_id,
    const CommandResult& result)
{
    flatbuffers::FlatBufferBuilder builder(response_builder_size);
    flatbuffers::Offset<void> payload;

    switch(result.payload_type)
    {
        case ServerPayload_Success:
            payload = CreateSuccess(builder).Union();
            break;

        case ServerPayload_Volume:
            payload = CreateVolume(builder, result.volume).Union();
            break;

        case ServerPayload_AudioFileList:
        {
            std::vector<flatbuffers::Offset<AudioFile>> files;
            files.reserve(result.audio_file_count);
            for(size_t i = 0; i < result.audio_file_count; ++i)
            {
                files.push_back(CreateAudioFileDirect(
                    builder,
                    result.audio_files[i].name,
                    result.audio_files[i].size));
            }

            payload = CreateAudioFileListDirect(builder, &files).Union();
            break;
        }

        case ServerPayload_Error:
            payload = CreateErrorDirect(
                builder,
                result.error_code,
                result.error_message).Union();
            break;

        default:
            return;
    }

    const auto server_message = CreateServerMessage(
        builder,
        request_id,
        result.payload_type,
        payload);
    const auto message = CreateMessage(
        builder,
        MessageBody_ServerMessage,
        server_message.Union());
    FinishMessageBuffer(builder, message);

    webSocket.sendBIN(
        client_num,
        builder.GetBufferPointer(),
        builder.GetSize());
}

static void handle_binary_message(
    uint8_t client_num,
    uint8_t* payload,
    size_t length)
{
    flatbuffers::Verifier verifier(payload, length);
    if(!VerifyMessageBuffer(verifier))
    {
        Serial.println("Invalid FlatBuffers message");
        return;
    }

    const auto* message = GetMessage(payload);
    const auto* client_message = message->body_as_ClientMessage();
    if(client_message == nullptr)
    {
        Serial.println("Received a non-client WebSocket message");
        return;
    }

    const CommandResult result = command_handler.handle(*client_message);
    if(client_message->request_id() != 0)
    {
        send_response(client_num, client_message->request_id(), result);
    }
}

static void web_socket_event(uint8_t client_num, WStype_t type,
    uint8_t* payload, size_t length)
{
    switch(type)
    {
        case WStype_CONNECTED:
        {
            connected_clients++;
            Serial.printf("Client %u connected (total: %u)\n", client_num, connected_clients);
            break;
        }

        case WStype_DISCONNECTED:
        {
            connected_clients--;
            Serial.printf("Client %u disconnected (total: %u)\n", client_num, connected_clients);

            // A client that drops mid-upload is never going to finish it.
            sd_audio_upload_cancel();
            break;
        }


        case WStype_BIN:
        {
            handle_binary_message(client_num, payload, length);
            break;
        }


        default:
            break;
    }
}

static void handle_get_ip()
{
    server.send(200, "text/plain", WiFi.localIP().toString());
}

static const char redirect_page[] PROGMEM =
#include "redirect_page.html"
    ; // Intentionally a semicolon here. The include file expands to a raw_string(...)

static bool is_softap_client()
{
    IPAddress client_ip = server.client().remoteIP();
    IPAddress ap_ip = WiFi.softAPIP();

    return client_ip[0] == ap_ip[0] &&
           client_ip[1] == ap_ip[1] &&
           client_ip[2] == ap_ip[2];
}

static void handle_root()
{
    if(is_softap_client())
    {
        server.send(200, "text/html", redirect_page);
        return;
    }

    File file = LittleFS.open("/index.html", "r");
    if(!file)
    {
        server.send(404, "text/plain", "Not found");
        return;
    }

    server.streamFile(file, "text/html");
    file.close();
}

void web_interface_init()
{
    filesystem_init();

    //Register HTTP routes
    server.on("/", HTTP_GET, handle_root);
    server.on("/api/ip", HTTP_GET, handle_get_ip);

    //Serve static files from LittleFS:
    server.serveStatic("/", LittleFS, "/", NULL);

    webSocket.onEvent(web_socket_event);

    Serial.println("Web interface initialized");
}

void web_interface_start()
{
    server.begin();
    webSocket.begin();

    Serial.println("Web interface started");
}

void web_interface_stop()
{
    server.stop();
    webSocket.close();

    Serial.println("Web interface stopped");
}

void web_interface_service() {
    server.handleClient();

    // webSocket.loop() only dequeues one already-buffered frame per call.
    // Audio-chunk and command frames (e.g. a button press) share the same
    // connection, so drain what's already waiting instead of trickling it
    // out one frame per Arduino loop() iteration -- otherwise a backlog of
    // audio frames delays any command queued behind them.
    for(uint8_t i = 0; i < max_websocket_frames_per_loop; ++i)
    {
        webSocket.loop();
    }
}
