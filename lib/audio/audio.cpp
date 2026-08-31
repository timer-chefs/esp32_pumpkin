#include "audio.h"
#include "AudioTools.h"
#include "config.h"
#include "fft.h"

static RingBufferStream audio_buffer(buffer_size);
static I2SStream i2s;
VolumeStream volume(i2s);
static StreamCopy copier(volume, audio_buffer);

static bool is_playback_running = false;

static constexpr size_t bytes_per_frame = (bits_per_sample / 8) * channels;
static constexpr size_t bytes_per_ms = (sample_rate * bytes_per_frame) / 1000;
static constexpr size_t catch_up_high_water_bytes = audio_catch_up_high_water_ms * bytes_per_ms;
static constexpr size_t catch_up_low_water_bytes = audio_catch_up_low_water_ms * bytes_per_ms;
static constexpr size_t catch_up_step_bytes = audio_catch_up_step_ms * bytes_per_ms;
static bool is_catching_up = false;

static void audio_buffer_clear()
{
    uint8_t scratch[64];
    while(audio_buffer.available() > 0)
    {
        audio_buffer.readBytes(scratch, min((size_t)sizeof(scratch), (size_t)audio_buffer.available()));
    }
    is_catching_up = false;
}

// Playback is paced by the I2S hardware clock, so it always drains the
// buffer at real-time speed. If a burst of audio arrives at once (e.g.
// after a network stall) the buffer fills up faster than it drains, and
// without this, that backlog would just play out later at normal speed
// forever instead of catching back up. Trimming a few ms off the oldest
// buffered audio on each write -- once we're significantly behind, until
// we're back near the target -- keeps latency bounded.
static void audio_catch_up_if_behind()
{
    size_t buffered = audio_buffer.available();

    if(!is_catching_up)
    {
        if(buffered <= catch_up_high_water_bytes)
        {
            return;
        }

        is_catching_up = true;
        if(enable_audio_stats_logging)
        {
            Serial.printf(
                "Audio catch-up: %u ms buffered, trimming toward %u ms\n",
                (unsigned)(buffered / bytes_per_ms),
                (unsigned)audio_catch_up_low_water_ms);
        }
    }

    if(buffered <= catch_up_low_water_bytes)
    {
        is_catching_up = false;
        return;
    }

    size_t to_drop = min(catch_up_step_bytes, buffered - catch_up_low_water_bytes);
    to_drop -= to_drop % bytes_per_frame;
    if(to_drop == 0)
    {
        return;
    }

    uint8_t scratch[catch_up_step_bytes];
    audio_buffer.readBytes(scratch, to_drop);
}

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

    fft_init();

    return true;
}

void audio_write(const uint8_t* payload, size_t length)
{
    write_to_fft(payload, length);
    audio_buffer.write(payload, length);
    audio_catch_up_if_behind();
}

void audio_started()
{
    is_playback_running = true;
}

void audio_stoped()
{
    is_playback_running = false;
    audio_buffer_clear();
}

bool is_audio_running()
{
    return is_playback_running;
}

void audio_service()
{
    if(is_playback_running)    
    {
        copier.copy();
    }
}

void set_volume(float volume_level)
{
    volume.setVolume(volume_level);
}

float get_volume()
{
    return volume.volume();
}
