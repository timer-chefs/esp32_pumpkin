#include "wifi_manager.h"

#include "config.h"
#include "web_interface.h"

#include "driver/gpio.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "nvs_flash.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_softap.h"

static constexpr EventBits_t connected_bit = BIT0;
static constexpr char proof_of_possession[] = "pumpkin1";
static EventGroupHandle_t wifi_events = nullptr;
static volatile bool wifi_config_request = false;
static bool provisioning_manager_initialized = false;
static const char* tag = "wifi_manager";

static void event_handler(
    void*,
    esp_event_base_t event_base,
    int32_t event_id,
    void* event_data)
{
    if(event_base == WIFI_EVENT)
    {
        if(event_id == WIFI_EVENT_STA_START)
        {
            esp_wifi_connect();
        }
        else if(event_id == WIFI_EVENT_STA_DISCONNECTED)
        {
            xEventGroupClearBits(wifi_events, connected_bit);
            esp_wifi_connect();
        }
    }
    else if(event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        const auto* event = static_cast<ip_event_got_ip_t*>(event_data);
        ESP_LOGI(tag, "Connected with IP " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(wifi_events, connected_bit);
    }
    else if(event_base == WIFI_PROV_EVENT)
    {
        if(event_id == WIFI_PROV_START)
        {
            ESP_LOGI(tag, "Provisioning started on SSID %s", wifi_provisioning_ssid);
            ESP_LOGI(tag, "Use ESP SoftAP Provisioning with PoP: %s", proof_of_possession);
        }
        else if(event_id == WIFI_PROV_CRED_FAIL)
        {
            ESP_LOGW(tag, "Provisioning credentials failed");
            wifi_prov_mgr_reset_sm_state_on_failure();
        }
        else if(event_id == WIFI_PROV_CRED_SUCCESS)
        {
            ESP_LOGI(tag, "Provisioning successful");
        }
        else if(event_id == WIFI_PROV_END && provisioning_manager_initialized)
        {
            wifi_prov_mgr_deinit();
            provisioning_manager_initialized = false;
        }
    }
}

static void initialize_provisioning_manager()
{
    if(provisioning_manager_initialized)
    {
        return;
    }

    wifi_prov_mgr_config_t manager_config = {};
    manager_config.scheme = wifi_prov_scheme_softap;
    manager_config.scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    manager_config.app_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    ESP_ERROR_CHECK(wifi_prov_mgr_init(manager_config));
    provisioning_manager_initialized = true;
}

static bool provision(bool reset_credentials)
{
    initialize_provisioning_manager();
    if(reset_credentials)
    {
        ESP_ERROR_CHECK(wifi_prov_mgr_reset_provisioning());
    }

    const wifi_prov_security1_params_t* security_parameters = proof_of_possession;
    ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
        WIFI_PROV_SECURITY_1,
        security_parameters,
        wifi_provisioning_ssid,
        nullptr));

    const EventBits_t result = xEventGroupWaitBits(
        wifi_events,
        connected_bit,
        pdFALSE,
        pdTRUE,
        pdMS_TO_TICKS(static_cast<uint32_t>(wifi_provisioning_timeout) * 1000));
    return (result & connected_bit) != 0;
}

static bool start_station()
{
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
    const EventBits_t result = xEventGroupWaitBits(
        wifi_events,
        connected_bit,
        pdFALSE,
        pdTRUE,
        pdMS_TO_TICKS(30000));
    return (result & connected_bit) != 0;
}

static void IRAM_ATTR config_button_isr(void*)
{
    wifi_config_request = true;
}

void wifi_manager_init()
{
    esp_err_t result = nvs_flash_init();
    if(result == ESP_ERR_NVS_NO_FREE_PAGES || result == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    }

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    wifi_events = xEventGroupCreate();
    ESP_ERROR_CHECK(wifi_events == nullptr ? ESP_ERR_NO_MEM : ESP_OK);

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, event_handler, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, event_handler, nullptr));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID, event_handler, nullptr));

    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();
    wifi_init_config_t wifi_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi_config));

    gpio_config_t button_config = {};
    button_config.pin_bit_mask = 1ULL << pin_wifi_provisioning_btn;
    button_config.mode = GPIO_MODE_INPUT;
    button_config.pull_up_en = GPIO_PULLUP_ENABLE;
    button_config.intr_type = GPIO_INTR_NEGEDGE;
    ESP_ERROR_CHECK(gpio_config(&button_config));
    ESP_ERROR_CHECK(gpio_install_isr_service(0));
    ESP_ERROR_CHECK(gpio_isr_handler_add(
        static_cast<gpio_num_t>(pin_wifi_provisioning_btn),
        config_button_isr,
        nullptr));

    initialize_provisioning_manager();
    bool is_provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&is_provisioned));

    if(is_provisioned)
    {
        wifi_prov_mgr_deinit();
        provisioning_manager_initialized = false;
        if(!start_station())
        {
            ESP_LOGW(tag, "Saved Wi-Fi unavailable; starting provisioning");
            ESP_ERROR_CHECK(esp_wifi_stop());
            if(!provision(true))
            {
                ESP_LOGE(tag, "Provisioning timed out");
                esp_restart();
            }
        }
    }
    else if(!provision(false))
    {
        ESP_LOGE(tag, "Provisioning timed out");
        esp_restart();
    }
}

void wifi_provisioning_handling()
{
    if(!wifi_config_request)
    {
        return;
    }

    wifi_config_request = false;
    ESP_LOGI(tag, "Reprovisioning requested");
    web_interface_stop();
    xEventGroupClearBits(wifi_events, connected_bit);

    if(!provision(true))
    {
        ESP_LOGE(tag, "Reprovisioning timed out");
        esp_restart();
    }

    web_interface_start();
}

