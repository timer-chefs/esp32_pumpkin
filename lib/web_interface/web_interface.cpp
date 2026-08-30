#include "web_interface.h"

#include "audio.h"
#include "config.h"
#include "command_handler.h"
#include "tls_certificate.h"

#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <esp_https_server.h>
#include <flatbuffers/flatbuffers.h>
#include <vector>
#include "pumpkin_generated.h"

static WebServer http_server(web_server_port);
static httpd_handle_t secure_server = nullptr;
static String certificate_pem;
static String private_key_pem;

extern CommandHandler command_handler;

using namespace Pumpkin::Protocol;

static void filesystem_init()
{
    if(!LittleFS.begin())
    {
        Serial.println("LittleFS Mount Failed");
        return;
    }
}

static esp_err_t send_response(
    httpd_req_t* request,
    uint32_t request_id,
    const CommandResult& result)
{
    flatbuffers::FlatBufferBuilder builder(128);
    flatbuffers::Offset<void> payload;

    switch(result.payload_type)
    {
        case ServerPayload_Success:
            payload = CreateSuccess(builder).Union();
            break;

        case ServerPayload_Volume:
            payload = CreateVolume(builder, result.volume).Union();
            break;

        case ServerPayload_Error:
            payload = CreateErrorDirect(
                builder,
                result.error_code,
                result.error_message).Union();
            break;

        default:
            return ESP_ERR_INVALID_ARG;
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

    httpd_ws_frame_t frame = {};
    frame.type = HTTPD_WS_TYPE_BINARY;
    frame.payload = builder.GetBufferPointer();
    frame.len = builder.GetSize();
    return httpd_ws_send_frame(request, &frame);
}

static esp_err_t handle_binary_message(
    httpd_req_t* request,
    uint8_t* payload,
    size_t length)
{
    flatbuffers::Verifier verifier(payload, length);
    if(!VerifyMessageBuffer(verifier))
    {
        Serial.println("Invalid FlatBuffers message");
        return ESP_OK;
    }

    const auto* message = GetMessage(payload);
    const auto* client_message = message->body_as_ClientMessage();
    if(client_message == nullptr)
    {
        Serial.println("Received a non-client WebSocket message");
        return ESP_OK;
    }

    const CommandResult result = command_handler.handle(*client_message);
    if(client_message->request_id() != 0)
    {
        return send_response(request, client_message->request_id(), result);
    }

    return ESP_OK;
}

static esp_err_t handle_web_socket(httpd_req_t* request)
{
    if(request->method == HTTP_GET)
    {
        Serial.printf("WebSocket client connected on socket %d\n", httpd_req_to_sockfd(request));
        return ESP_OK;
    }

    httpd_ws_frame_t frame = {};
    esp_err_t result = httpd_ws_recv_frame(request, &frame, 0);
    if(result != ESP_OK)
    {
        return result;
    }

    constexpr size_t maximum_message_size = buffer_size * 2;
    if(frame.len == 0 || frame.len > maximum_message_size)
    {
        Serial.printf("Invalid WebSocket message size: %u\n", frame.len);
        return ESP_ERR_INVALID_SIZE;
    }

    std::vector<uint8_t> payload(frame.len);
    frame.payload = payload.data();
    result = httpd_ws_recv_frame(request, &frame, payload.size());
    if(result != ESP_OK)
    {
        return result;
    }

    if(frame.type != HTTPD_WS_TYPE_BINARY)
    {
        return ESP_OK;
    }

    return handle_binary_message(request, payload.data(), payload.size());
}

static void handle_http_get_ip()
{
    http_server.send(200, "text/plain", WiFi.localIP().toString());
}

static const char redirect_page[] PROGMEM =
#include "redirect_page.html"
    ; // Intentionally a semicolon here. The include file expands to a raw_string(...)

static bool is_softap_client()
{
    IPAddress client_ip = http_server.client().remoteIP();
    IPAddress ap_ip = WiFi.softAPIP();

    return client_ip[0] == ap_ip[0] &&
           client_ip[1] == ap_ip[1] &&
           client_ip[2] == ap_ip[2];
}

static void handle_http_request()
{
    if(is_softap_client())
    {
        http_server.send(200, "text/html", redirect_page);
        return;
    }

    http_server.sendHeader(
        "Location",
        String("https://") + WiFi.localIP().toString());
    http_server.send(307, "text/plain", "Redirecting to HTTPS");
}

static esp_err_t handle_secure_get_ip(httpd_req_t* request)
{
    const String ip_address = WiFi.localIP().toString();
    httpd_resp_set_type(request, "text/plain");
    return httpd_resp_send(request, ip_address.c_str(), ip_address.length());
}

static const char* content_type_for(const String& path)
{
    if(path.endsWith(".html")) return "text/html";
    if(path.endsWith(".css")) return "text/css";
    if(path.endsWith(".js")) return "application/javascript";
    if(path.endsWith(".json")) return "application/json";
    if(path.endsWith(".svg")) return "image/svg+xml";
    if(path.endsWith(".png")) return "image/png";
    if(path.endsWith(".ico")) return "image/x-icon";
    if(path.endsWith(".wasm")) return "application/wasm";
    return "application/octet-stream";
}

static esp_err_t handle_static_file(httpd_req_t* request)
{
    String path = request->uri;
    if(path == "/")
    {
        path = "/index.html";
    }

    if(path.indexOf("..") >= 0)
    {
        return httpd_resp_send_err(request, HTTPD_404_NOT_FOUND, "Not found");
    }

    File file = LittleFS.open(path, "r");
    if(!file)
    {
        return httpd_resp_send_err(request, HTTPD_404_NOT_FOUND, "Not found");
    }

    httpd_resp_set_type(request, content_type_for(path));
    uint8_t buffer[1024];
    esp_err_t result = ESP_OK;
    while(file.available())
    {
        const size_t length = file.read(buffer, sizeof(buffer));
        result = httpd_resp_send_chunk(
            request,
            reinterpret_cast<const char*>(buffer),
            length);
        if(result != ESP_OK)
        {
            break;
        }
    }
    file.close();

    if(result != ESP_OK)
    {
        return result;
    }

    return httpd_resp_send_chunk(request, nullptr, 0);
}

static bool register_secure_routes()
{
    static const httpd_uri_t web_socket_uri = {
        .uri = "/ws",
        .method = HTTP_GET,
        .handler = handle_web_socket,
        .user_ctx = nullptr,
        .is_websocket = true,
        .handle_ws_control_frames = false,
        .supported_subprotocol = nullptr,
    };
    static const httpd_uri_t get_ip_uri = {
        .uri = "/api/ip",
        .method = HTTP_GET,
        .handler = handle_secure_get_ip,
        .user_ctx = nullptr,
        .is_websocket = false,
        .handle_ws_control_frames = false,
        .supported_subprotocol = nullptr,
    };
    static const httpd_uri_t static_file_uri = {
        .uri = "/*",
        .method = HTTP_GET,
        .handler = handle_static_file,
        .user_ctx = nullptr,
        .is_websocket = false,
        .handle_ws_control_frames = false,
        .supported_subprotocol = nullptr,
    };

    return httpd_register_uri_handler(secure_server, &web_socket_uri) == ESP_OK &&
           httpd_register_uri_handler(secure_server, &get_ip_uri) == ESP_OK &&
           httpd_register_uri_handler(secure_server, &static_file_uri) == ESP_OK;
}

void web_interface_init()
{
    filesystem_init();

    http_server.on("/api/ip", HTTP_GET, handle_http_get_ip);
    http_server.on("/", HTTP_GET, handle_http_request);
    http_server.onNotFound(handle_http_request);

    Serial.println("Web interface initialized");
}

void web_interface_start()
{
    http_server.begin();

    if(secure_server != nullptr)
    {
        return;
    }

    if(!tls_certificate_load(certificate_pem, private_key_pem))
    {
        Serial.println("HTTPS server could not load its certificate");
        return;
    }

    httpd_ssl_config_t config = HTTPD_SSL_CONFIG_DEFAULT();
    config.port_secure = secure_web_server_port;
    config.httpd.uri_match_fn = httpd_uri_match_wildcard;
    config.cacert_pem = reinterpret_cast<const uint8_t*>(certificate_pem.c_str());
    config.cacert_len = certificate_pem.length() + 1;
    config.prvtkey_pem = reinterpret_cast<const uint8_t*>(private_key_pem.c_str());
    config.prvtkey_len = private_key_pem.length() + 1;

    if(httpd_ssl_start(&secure_server, &config) != ESP_OK)
    {
        secure_server = nullptr;
        Serial.println("HTTPS server failed to start");
        return;
    }

    if(!register_secure_routes())
    {
        httpd_ssl_stop(secure_server);
        secure_server = nullptr;
        Serial.println("HTTPS routes failed to register");
        return;
    }

    Serial.println("Web interface started on HTTPS/WSS");
}

void web_interface_stop()
{
    http_server.stop();
    if(secure_server != nullptr)
    {
        httpd_ssl_stop(secure_server);
        secure_server = nullptr;
    }

    Serial.println("Web interface stopped");
}

void web_interface_service()
{
    http_server.handleClient();
}
