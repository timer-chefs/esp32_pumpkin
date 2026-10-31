#include "fft.h"
#include "config.h"
#include "AudioTools/AudioLibs/AudioRealFFT.h"

#include <algorithm>

// Beats are looked for in the bins that carry drums and voices. The FFT is
// left at its default of two channels, so it reads every other sample of
// the mono audio: a spectrum comes out every 32 ms, in bins of about 31 Hz.
static constexpr int beat_lowest_bin = 1;
static constexpr int beat_highest_bin = 16;

// How much more than lately the low end has to rise to count as a beat.
static constexpr float beat_threshold_ratio = 1.6f;
// ...and how much it has to rise at the least, so near silence has none.
static constexpr float beat_min_rise = 1.0f;
// How much each spectrum moves the "lately", about a second's worth.
static constexpr float beat_average_weight = 0.05f;
// Nothing faster than 200 beats a minute counts.
static constexpr uint32_t beat_min_interval_ms = 300;

AudioRealFFT fft;

static float previous_magnitudes[beat_highest_bin + 1];
static float average_rise = 0;
static uint32_t last_beat_ms = 0;
static bool is_beat_pending = false;

// Compares each spectrum with the one before. Only rises count, so a sound
// dying away isn't mistaken for one starting.
static void detect_beat(AudioFFTBase& analysed)
{
    float rise = 0;
    for(int i = beat_lowest_bin; i <= beat_highest_bin; i++)
    {
        const float magnitude = analysed.magnitude(i);
        rise += std::max(0.0f, magnitude - previous_magnitudes[i]);
        previous_magnitudes[i] = magnitude;
    }

    const uint32_t now = millis();
    if(rise > beat_min_rise &&
       rise > average_rise * beat_threshold_ratio &&
       now - last_beat_ms >= beat_min_interval_ms)
    {
        is_beat_pending = true;
        last_beat_ms = now;
    }

    average_rise += (rise - average_rise) * beat_average_weight;
}

void fft_init()
{
    auto tcfg = fft.defaultConfig();
    tcfg.length = num_of_samples_per_analysis_block;
    tcfg.callback = detect_beat;
    fft.begin(tcfg);
}

void write_to_fft(const uint8_t* payload, size_t length)
{
    fft.write(payload, length);
}

float get_fft_energy()
{
    float sum = 0;
    for(int i = 2; i < 30; i++)     //ferquency bins 2 to 30 hold the most audio fluctuation.
    {
        sum += fft.magnitude(i);
    }
    return sum / 28.0f;             //Avereging the sum
}

bool fft_take_beat()
{
    const bool beat = is_beat_pending;
    is_beat_pending = false;
    return beat;
}
