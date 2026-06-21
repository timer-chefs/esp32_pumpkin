#include "audio.h"
#include "AudioTools.h"
#include "config.h"

static RingBufferStream audio_buffer(buffer_size);
static I2SStream i2s;
VolumeStream volume(i2s);
static StreamCopy copier(volume, audio_buffer);

static constexpr size_t i2s_chunk_size = 512;
static bool playback_started = false;
static constexpr size_t playback_start_threshold = 4096;

bool audio_init()
{
    auto i2s_config = i2s.defaultConfig(TX_MODE);
    i2s_config.sample_rate = sample_rate;
    i2s_config.channels = channels;
    i2s_config.bits_per_sample = bits_per_sample;
    i2s_config.pin_bck = pin_bck;
    i2s_config.pin_ws = pin_ws;
    i2s_config.pin_data = pin_data;
    i2s_config.use_apll = true;         //Use APLL for better accuracy
    i2s_config.fixed_mclk = 0;          //Auto claculate MCLK
    i2s_config.buffer_size = 512;       // DMA buffer size in samples
    i2s_config.buffer_count = 4;        // Number of DMA buffers

    if(!i2s.begin(i2s_config)) {
        Serial.println("I2S begin failed");
        return false;
    }

    auto volume_config = volume.defaultConfig();
    volume_config.copyFrom(i2s_config);

    if(!volume.begin(volume_config))
    {
        Serial.println("Volume begin failed");
        return false;
    }

    volume.setVolume(0.2f);

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

void set_volume(float volume_level)
{
    volume.setVolume(volume_level);
}

float get_volume()
{
    return volume.volume();
}
