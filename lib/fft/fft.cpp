#include "fft.h"
#include "config.h"
#include "AudioTools/AudioLibs/AudioRealFFT.h"

AudioRealFFT fft;

void fft_init()
{
    auto tcfg = fft.defaultConfig();
    tcfg.length = num_of_samples_per_analysis_block;
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

