#include "web_interface.h"

#include "audio.h"
#include "command_handler.h"
#include "config.h"

#include "cJSON.h"
#include "esp_http_server.h"
#include "esp_littlefs.h"
#include "esp_log.h"
#include "esp_netif.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

static httpd_handle_t web_server = nullptr;
static httpd_handle_t socket_server = nullptr;
static const char* tag = "web_interface";

extern CommandHandler command_handler;

static esp_err_t send_volume(httpd_req_t* request)
{
    char response[32];
    snprintf(response, sizeof(response), "{\"volume\":%.2f}", get_volume());
    httpd_resp_set_type(request, "application/json");
    return httpd_resp_sendstr(request, response);
}

static esp_err_t handle_audio_reset(httpd_req_t* request)
{
    audio_stoped();
    httpd_resp_set_type(request, "application/json");
    return httpd_resp_sendstr(request, "{\"status\":\"reset\"}");
}

static esp_err_t handle_volume_up(httpd_req_t* request)
{
    set_volume(get_volume() + 0.1f);
    return send_volume(request);
}

static esp_err_t handle_volume_down(httpd_req_t* request)
{
    set_volume(get_volume() - 0.1f);
    return send_volume(request);
}

static esp_err_t handle_get_volume(httpd_req_t* request)
{
    return send_volume(request);
}

static esp_err_t handle_get_ip(httpd_req_t* request)
{
    esp_netif_t* station = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    esp_netif_ip_info_t ip_info = {};
    char address[16] = {};

    if(station != nullptr && esp_netif_get_ip_info(station, &ip_info) == ESP_OK)
    {
        snprintf(address, sizeof(address), IPSTR, IP2STR(&ip_info.ip));
    }

    httpd_resp_set_type(request, "text/plain");
    return httpd_resp_sendstr(request, address);
}

static const char* content_type(const char* path)
{
    if(strstr(path, ".html") != nullptr) return "text/html";
    if(strstr(path, ".js") != nullptr) return "text/javascript";
    if(strstr(path, ".css") != nullptr) return "text/css";
    if(strstr(path, ".json") != nullptr) return "application/json";
    return "application/octet-stream";
}

static esp_err_t handle_static_file(httpd_req_t* request)
{
    std::string uri = request->uri;
    const size_t query_start = uri.find('?');
    if(query_start != std::string::npos)
    {
        uri.resize(query_start);
    }
    if(uri == "/")
    {
        uri = "/index.html";
    }
    if(uri.find("..") != std::string::npos)
    {
        return httpd_resp_send_err(request, HTTPD_400_BAD_REQUEST, "Invalid path");
    }

    const std::string content_path = "/littlefs" + uri;
    std::string file_path = content_path;
    FILE* file = fopen(file_path.c_str(), "rb");
    bool compressed = false;
    if(file == nullptr)
    {
        file_path += ".gz";
        file = fopen(file_path.c_str(), "rb");
        compressed = file != nullptr;
    }
    if(file == nullptr)
    {
        if(uri == "/index.html")
        {
            httpd_resp_set_status(request, "503 Service Unavailable");
            httpd_resp_set_type(request, "text/plain");
            return httpd_resp_sendstr(
                request,
                "Web assets are not installed; run PlatformIO uploadfs");
        }
        return httpd_resp_send_err(request, HTTPD_404_NOT_FOUND, "Not found");
    }

    httpd_resp_set_type(request, content_type(content_path.c_str()));
    if(compressed)
    {
        httpd_resp_set_hdr(request, "Content-Encoding", "gzip");
    }

    char buffer[1024];
    size_t bytes_read = 0;
    esp_err_t result = ESP_OK;
    while((bytes_read = fread(buffer, 1, sizeof(buffer), file)) > 0)
    {
        result = httpd_resp_send_chunk(request, buffer, bytes_read);
        if(result != ESP_OK)
        {
            break;
        }
    }
    fclose(file);
    httpd_resp_send_chunk(request, nullptr, 0);
    return result;
}

static esp_err_t handle_websocket(httpd_req_t* request)
{
    if(request->method == HTTP_GET)
    {
        ESP_LOGI(tag, "WebSocket client connected");
        return ESP_OK;
    }

    httpd_ws_frame_t frame = {};
    esp_err_t result = httpd_ws_recv_frame(request, &frame, 0);
    if(result != ESP_OK || frame.len == 0)
    {
        return result;
    }

    std::vector<uint8_t> payload(frame.len + 1);
    frame.payload = payload.data();
    result = httpd_ws_recv_frame(request, &frame, frame.len);
    if(result != ESP_OK)
    {
        return result;
    }

    if(frame.type == HTTPD_WS_TYPE_TEXT)
    {
        payload[frame.len] = '\0';
        cJSON* document = cJSON_ParseWithLength(
            reinterpret_cast<const char*>(payload.data()),
            frame.len);
        if(document == nullptr)
        {
            ESP_LOGW(tag, "Invalid JSON command");
            return ESP_OK;
        }
        command_handler.handle(document);
        cJSON_Delete(document);
    }
    else if(frame.type == HTTPD_WS_TYPE_BINARY)
    {
        audio_write(payload.data(), frame.len);
    }

    return ESP_OK;
}

static void register_uri(
    httpd_handle_t server,
    const char* uri,
    httpd_method_t method,
    esp_err_t (*handler)(httpd_req_t*))
{
    httpd_uri_t definition = {};
    definition.uri = uri;
    definition.method = method;
    definition.handler = handler;
    ESP_ERROR_CHECK(httpd_register_uri_handler(server, &definition));
}

void web_interface_init()
{
    const esp_vfs_littlefs_conf_t filesystem_config = {
        .base_path = "/littlefs",
        .partition_label = "littlefs",
        .partition = nullptr,
        .format_if_mount_failed = true,
        .read_only = false,
        .dont_mount = false,
        .grow_on_mount = false,
    };
    const esp_err_t result = esp_vfs_littlefs_register(&filesystem_config);
    if(result != ESP_OK)
    {
        ESP_LOGE(tag, "LittleFS unavailable: %s", esp_err_to_name(result));
        return;
    }

    size_t total_bytes = 0;
    size_t used_bytes = 0;
    if(esp_littlefs_info("littlefs", &total_bytes, &used_bytes) == ESP_OK)
    {
        ESP_LOGI(
            tag,
            "LittleFS mounted: %u/%u bytes used",
            static_cast<unsigned>(used_bytes),
            static_cast<unsigned>(total_bytes));
    }
}

void web_interface_start()
{
    httpd_config_t web_config = HTTPD_DEFAULT_CONFIG();
    web_config.server_port = web_server_port;
    web_config.uri_match_fn = httpd_uri_match_wildcard;
    ESP_ERROR_CHECK(httpd_start(&web_server, &web_config));

    register_uri(web_server, "/api/audio/reset", HTTP_GET, handle_audio_reset);
    register_uri(web_server, "/api/audio/volume/up", HTTP_POST, handle_volume_up);
    register_uri(web_server, "/api/audio/volume/down", HTTP_POST, handle_volume_down);
    register_uri(web_server, "/api/audio/volume", HTTP_GET, handle_get_volume);
    register_uri(web_server, "/api/ip", HTTP_GET, handle_get_ip);
    register_uri(web_server, "/*", HTTP_GET, handle_static_file);

    httpd_config_t socket_config = HTTPD_DEFAULT_CONFIG();
    socket_config.server_port = web_socket_port;
    socket_config.ctrl_port += 1;
    ESP_ERROR_CHECK(httpd_start(&socket_server, &socket_config));

    httpd_uri_t websocket_uri = {};
    websocket_uri.uri = "/";
    websocket_uri.method = HTTP_GET;
    websocket_uri.handler = handle_websocket;
    websocket_uri.is_websocket = true;
    ESP_ERROR_CHECK(httpd_register_uri_handler(socket_server, &websocket_uri));

    ESP_LOGI(tag, "HTTP and WebSocket servers started");
}

void web_interface_stop()
{
    if(web_server != nullptr)
    {
        httpd_stop(web_server);
        web_server = nullptr;
    }
    if(socket_server != nullptr)
    {
        httpd_stop(socket_server);
        socket_server = nullptr;
    }
}

void web_interface_service()
{
}
