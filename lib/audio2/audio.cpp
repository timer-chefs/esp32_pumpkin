#include "audio.h"
#include "AudioTools.h"
#include "config.h"

static RingBufferStream audio_buffer(buffer_size);
static I2SStream i2s;
static StreamCopy copier(i2s, audio_buffer);

static constexpr size_t i2s_chunk_size = 512;
static bool playback_started = false;
static constexpr size_t playback_start_threshold = 4096;

bool audio_init()
{
    auto config = i2s.defaultConfig(TX_MODE);
    config.sample_rate = sample_rate;
    config.channels = channels;
    config.bits_per_sample = bits_per_sample;
    config.pin_bck = pin_bck;
    config.pin_ws = pin_ws;
    config.pin_data = pin_data;
    config.use_apll = true;         //Use APLL for better accuracy
    config.fixed_mclk = 0;          //Auto claculate MCLK
    config.buffer_size = 512;       // DMA buffer size in samples
    config.buffer_count = 4;        // Number of DMA buffers

    if(!i2s.begin(config)) {
        Serial.println("I2S begin failed");
        return false;
    }
    return true;
}

void audio_write(const uint8_t* payload, size_t length)
{
    size_t bytes_written = audio_buffer.write(payload, length);
}


void audio_service()
{
    uint32_t available = audio_buffer.available();

    if (!playback_started)
    {
        if (available < playback_start_threshold)
        {
            return;
        }

        playback_started = true;
    }

    copier.copy();

    if (audio_buffer.available() == 0)
    {
        playback_started = false;
    }
}


void audio_reset() {
    playback_started = false;
}
