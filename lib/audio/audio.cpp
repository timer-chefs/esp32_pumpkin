#include "audio.h"
#include "AudioTools.h"
#include "config.h"
#include "fft.h"

#include <string.h>

static RingBufferStream audio_buffer(buffer_size);
static I2SStream i2s;
VolumeStream volume(i2s);

static bool is_playback_running = false;

static constexpr size_t bytes_per_frame = (bits_per_sample / 8) * channels;
static constexpr size_t bytes_per_ms = (sample_rate * bytes_per_frame) / 1000;
static constexpr size_t catch_up_high_water_bytes = audio_catch_up_high_water_ms * bytes_per_ms;
static constexpr size_t catch_up_low_water_bytes = audio_catch_up_low_water_ms * bytes_per_ms;
static constexpr size_t catch_up_step_bytes = audio_catch_up_step_ms * bytes_per_ms;
static constexpr size_t catch_up_crossfade_bytes = audio_catch_up_crossfade_ms * bytes_per_ms;
static bool is_catching_up = false;

// Chunk size used to pull audio out of the ring buffer for playback. Needs
// to be comfortably bigger than catch_up_step_bytes + catch_up_crossfade_bytes
// so a whole trim-and-crossfade always fits inside a single chunk.
static constexpr size_t playback_chunk_bytes = 1024;
static uint8_t playback_chunk[playback_chunk_bytes];

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
// buffered audio on each playback chunk -- once we're significantly behind,
// until we're back near the target -- keeps latency bounded.
//
// The trim itself is cross-faded rather than cut outright: cutting a
// waveform at an arbitrary point creates a sample-value discontinuity,
// which is heard as a click. Blending the samples right before the cut into
// the samples right after it removes the same amount of time but leaves no
// discontinuity, so it's inaudible instead of a click -- and a run of many
// small trims stays smooth instead of turning into a string of clicks.
static size_t catch_up_bytes_needed(size_t buffered)
{
    if(!is_catching_up)
    {
        if(buffered <= catch_up_high_water_bytes)
        {
            return 0;
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
        return 0;
    }

    size_t to_drop = min(catch_up_step_bytes, buffered - catch_up_low_water_bytes);
    to_drop -= to_drop % bytes_per_frame;
    return to_drop;
}

// Removes `to_drop` bytes from `chunk` (of length `n`), cross-fading over
// catch_up_crossfade_bytes at the seam instead of cutting it outright.
// Returns the new, shorter length. If there isn't enough room in this chunk
// to fit the drop plus a full crossfade, leaves the chunk untouched --
// there will be another chunk along shortly to try again on.
static size_t apply_catch_up_drop(uint8_t* chunk, size_t n, size_t to_drop)
{
    if(to_drop == 0 || n < to_drop + catch_up_crossfade_bytes)
    {
        return n;
    }

    auto* samples = reinterpret_cast<int16_t*>(chunk);
    size_t fade_samples = catch_up_crossfade_bytes / sizeof(int16_t);
    size_t drop_samples = to_drop / sizeof(int16_t);

    for(size_t i = 0; i < fade_samples; i++)
    {
        float t = (float)i / (float)fade_samples;
        int16_t before_cut = samples[i];
        int16_t after_cut = samples[drop_samples + i];
        samples[i] = (int16_t)(before_cut * (1.0f - t) + after_cut * t);
    }

    size_t tail_bytes = n - to_drop - catch_up_crossfade_bytes;
    memmove(chunk + catch_up_crossfade_bytes, chunk + to_drop + catch_up_crossfade_bytes, tail_bytes);

    return catch_up_crossfade_bytes + tail_bytes;
}

// Pulls the next chunk of audio out of the ring buffer and sends it to
// playback, applying a catch-up trim first if we're behind.
static void audio_copy_to_playback()
{
    size_t buffered = audio_buffer.available();
    if(buffered == 0)
    {
        return;
    }

    size_t to_drop = catch_up_bytes_needed(buffered);

    size_t to_read = min(buffered, playback_chunk_bytes);
    size_t n = audio_buffer.readBytes(playback_chunk, to_read);
    n = apply_catch_up_drop(playback_chunk, n, to_drop);

    volume.write(playback_chunk, n);
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
        audio_copy_to_playback();
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
