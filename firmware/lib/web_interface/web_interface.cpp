#include "web_interface.h"

#include "audio.h"
#include "config.h"
#include "command_handler.h"
#include "command_registry.h"
#include "device_log.h"
#include "sd_upload.h"

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <LittleFS.h>
#include <esp_random.h>
#include <lwip/sockets.h>
#include <flatbuffers/flatbuffers.h>
#include "pumpkin_generated.h"

// The library's own sends wait for as long as a client takes to make room
// for them, which suits a response the client is waiting on. The log mustn't
// hold up loop() like that, so it asks first.
class WebSocketsServerWithRoomCheck : public WebSocketsServer
{
public:
    using WebSocketsServer::WebSocketsServer;

    // Whether a message of up to max_log_message_size would go out to
    // `client_num` straight away, without waiting on the client.
    bool has_room(uint8_t client_num)
    {
        const WSclient_t& client = _clients[client_num];
        if(client.status != WSC_CONNECTED || client.tcp == nullptr)
        {
            return false;
        }

        const int socket = client.tcp->fd();
        if(socket < 0)
        {
            return false;
        }

        fd_set writable;
        FD_ZERO(&writable);
        FD_SET(socket, &writable);
        timeval no_wait = {0, 0};
        return select(socket + 1, nullptr, &writable, nullptr, &no_wait) > 0;
    }
};

static WebServer server(web_server_port);
static WebSocketsServerWithRoomCheck webSocket(web_socket_port);

// Reused for every message the device sends, so a busy stream isn't
// allocating a buffer per message. Safe because messages are handled one at
// a time from loop().
static flatbuffers::FlatBufferBuilder response_builder(response_builder_size);
static uint16_t connected_clients = 0;

// A command that answers later leaves its caller here until it does. Only
// one command defers at a time, so one slot is enough.
static uint8_t deferred_client = 0;
static uint32_t deferred_request_id = 0;

// How far through the device log each client has been sent.
static bool is_log_reader[WEBSOCKETS_SERVER_CLIENT_MAX] = {};
static uint32_t log_cursors[WEBSOCKETS_SERVER_CLIENT_MAX] = {};
static char log_text[max_log_message_size];
static uint32_t boot_id = 0;

using namespace Pumpkin::Protocol;

static void filesystem_init()
{
    if(!LittleFS.begin())
    {
        device_log.println("LittleFS Mount Failed");
        return;
    }
}

// Sends a payload already built into response_builder.
static void send_server_message(
    uint8_t client_num,
    uint32_t request_id,
    const CommandResult& result)
{
    const auto server_message = CreateServerMessage(
        response_builder,
        request_id,
        result.payload_type,
        result.payload);
    const auto message = CreateMessage(
        response_builder,
        MessageBody_ServerMessage,
        server_message.Union());
    FinishMessageBuffer(response_builder, message);

    webSocket.sendBIN(
        client_num,
        response_builder.GetBufferPointer(),
        response_builder.GetSize());
}

static void handle_binary_message(
    uint8_t client_num,
    uint8_t* payload,
    size_t length)
{
    flatbuffers::Verifier verifier(payload, length);
    if(!VerifyMessageBuffer(verifier))
    {
        device_log.println("Invalid FlatBuffers message");
        return;
    }

    const auto* message = GetMessage(payload);
    const auto* client_message = message->body_as_ClientMessage();
    if(client_message == nullptr)
    {
        device_log.println("Received a non-client WebSocket message");
        return;
    }

    response_builder.Clear();
    const CommandResult result =
        handle_command({client_num}, *client_message, response_builder);

    if(client_message->request_id() == 0)
    {
        return;
    }

    if(result.payload_type == ServerPayload_NONE)
    {
        deferred_client = client_num;
        deferred_request_id = client_message->request_id();
        return;
    }

    send_server_message(client_num, client_message->request_id(), result);
}

static void web_socket_event(uint8_t client_num, WStype_t type,
    uint8_t* payload, size_t length)
{
    switch(type)
    {
        case WStype_CONNECTED:
        {
            connected_clients++;
            device_log.printf("Client %u connected (total: %u)\n", client_num, connected_clients);

            // From the start, which read_lines() moves up to the oldest
            // line the history still has.
            is_log_reader[client_num] = true;
            log_cursors[client_num] = 0;
            break;
        }

        case WStype_DISCONNECTED:
        {
            connected_clients--;
            device_log.printf("Client %u disconnected (total: %u)\n", client_num, connected_clients);
            is_log_reader[client_num] = false;

            // A client that drops mid-upload is never going to finish it,
            // but another client's upload is none of its business.
            sd_upload_client_disconnected(client_num);

            // Nothing to answer if the client that was waiting is gone.
            if(deferred_request_id != 0 && deferred_client == client_num)
            {
                deferred_request_id = 0;
            }
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

    // The radio is on by now, which is what makes esp_random() truly random.
    boot_id = esp_random();

    device_log.println("Web interface initialized");
}

void web_interface_start()
{
    server.begin();
    webSocket.begin();

    device_log.println("Web interface started");
}

void web_interface_stop()
{
    server.stop();
    webSocket.close();

    device_log.println("Web interface stopped");
}

// Sends the answer to a command that couldn't give one straight away.
static void service_deferred_response()
{
    if(deferred_request_id == 0)
    {
        return;
    }

    response_builder.Clear();
    CommandResult result;
    if(!take_completed_command(result, response_builder))
    {
        return;
    }

    send_server_message(deferred_client, deferred_request_id, result);
    deferred_request_id = 0;
}

static void send_log(uint8_t client_num, uint32_t position, size_t length)
{
    response_builder.Clear();
    const auto log = CreateLog(
        response_builder,
        boot_id,
        position,
        response_builder.CreateString(log_text, length));
    send_server_message(client_num, 0, {ServerPayload_Log, log.Union()});
}

// Sends each client one message's worth of the log it hasn't seen yet. A
// client with no room for it right now gets it on a later turn, so a slow
// client can't hold up loop(); one that falls further behind than the
// history reaches loses what it missed.
static void service_log()
{
    for(uint8_t client_num = 0; client_num < WEBSOCKETS_SERVER_CLIENT_MAX; ++client_num)
    {
        uint32_t& cursor = log_cursors[client_num];
        if(!is_log_reader[client_num] ||
           cursor == device_log.end() ||
           !webSocket.has_room(client_num))
        {
            continue;
        }

        const size_t length =
            device_log.read_lines(cursor, log_text, sizeof(log_text));
        if(length > 0)
        {
            send_log(client_num, cursor - length, length);
        }
    }
}

void web_interface_service() {
    server.handleClient();

    service_deferred_response();

    // webSocket.loop() only dequeues one already-buffered frame per call.
    // Audio-chunk and command frames (e.g. a button press) share the same
    // connection, so drain what's already waiting instead of trickling it
    // out one frame per Arduino loop() iteration -- otherwise a backlog of
    // audio frames delays any command queued behind them.
    for(uint8_t i = 0; i < max_websocket_frames_per_loop; ++i)
    {
        webSocket.loop();
    }

    service_log();
}
