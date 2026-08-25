#include "audio.h"
#include "config.h"
#include "fft.h"

#include "driver/i2s_std.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/ringbuf.h"

#include <algorithm>

static constexpr size_t i2s_chunk_size = 512;
static bool is_playback_running = false;
static float volume = 0.2f;
static i2s_chan_handle_t tx_channel = nullptr;
static RingbufHandle_t audio_buffer = nullptr;
static const char* tag = "audio";

bool audio_init()
{
    audio_buffer = xRingbufferCreate(buffer_size, RINGBUF_TYPE_BYTEBUF);
    if(audio_buffer == nullptr)
    {
        ESP_LOGE(tag, "Audio ring buffer allocation failed");
        return false;
    }

    i2s_chan_config_t channel_config = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    channel_config.dma_desc_num = 4;
    channel_config.dma_frame_num = i2s_chunk_size / sizeof(int16_t);

    if(i2s_new_channel(&channel_config, &tx_channel, nullptr) != ESP_OK)
    {
        ESP_LOGE(tag, "I2S channel creation failed");
        return false;
    }

    const i2s_std_config_t standard_config = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(sample_rate),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_16BIT,
            I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = static_cast<gpio_num_t>(pin_bck),
            .ws = static_cast<gpio_num_t>(pin_ws),
            .dout = static_cast<gpio_num_t>(pin_data),
            .din = I2S_GPIO_UNUSED,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };

    if(i2s_channel_init_std_mode(tx_channel, &standard_config) != ESP_OK ||
       i2s_channel_enable(tx_channel) != ESP_OK)
    {
        ESP_LOGE(tag, "I2S initialization failed");
        return false;
    }

    fft_init();

    return true;
}

void audio_write(const uint8_t* payload, size_t length)
{
    write_to_fft(payload, length);
    if(xRingbufferSend(audio_buffer, payload, length, 0) != pdTRUE)
    {
        ESP_LOGW(tag, "Audio buffer full; dropped %u bytes", static_cast<unsigned>(length));
    }
}

void audio_started()
{
    is_playback_running = true;
}

void audio_stoped()
{
    is_playback_running = false;
}

bool is_audio_running()
{
    return is_playback_running;
}

void audio_service()
{
    if(!is_playback_running || audio_buffer == nullptr)
    {
        return;
    }

    size_t received_size = 0;
    uint8_t* data = static_cast<uint8_t*>(xRingbufferReceiveUpTo(
        audio_buffer,
        &received_size,
        0,
        i2s_chunk_size));
    if(data == nullptr)
    {
        return;
    }

    int16_t* samples = reinterpret_cast<int16_t*>(data);
    for(size_t index = 0; index < received_size / sizeof(int16_t); ++index)
    {
        samples[index] = static_cast<int16_t>(samples[index] * volume);
    }

    size_t bytes_written = 0;
    i2s_channel_write(tx_channel, data, received_size, &bytes_written, portMAX_DELAY);
    vRingbufferReturnItem(audio_buffer, data);
}

void set_volume(float volume_level)
{
    volume = std::clamp(volume_level, 0.0f, 1.0f);
}

float get_volume()
{
    return volume;
}
