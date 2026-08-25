#include "pumpkin_led_strip.h"

#include "esp_check.h"
#include "esp_log.h"
#include <led_strip.h>
#include <led_strip_rmt.h>

RgbColor led_strip[num_leds];
static led_strip_handle_t strip_handle = nullptr;
static const char* tag = "led_strip";

void led_strip_init()
{
    const led_strip_config_t strip_config = {
        .strip_gpio_num = pin_led_strip,
        .max_leds = num_leds,
        .led_model = LED_MODEL_WS2812,
        .color_component_format = LED_STRIP_COLOR_COMPONENT_FMT_RGB,
        .flags = {
            .invert_out = false,
        },
    };
    const led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000,
        .mem_block_symbols = 0,
        .flags = {
            .with_dma = false,
        },
    };

    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &strip_handle));
    ESP_LOGI(tag, "LED strip initialized");
}

void led_strip_show()
{
    for(uint8_t index = 0; index < num_leds; ++index)
    {
        ESP_ERROR_CHECK(led_strip_set_pixel(
            strip_handle,
            index,
            led_strip[index].red,
            led_strip[index].green,
            led_strip[index].blue));
    }
    ESP_ERROR_CHECK(led_strip_refresh(strip_handle));
}

