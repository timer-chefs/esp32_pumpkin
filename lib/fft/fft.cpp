#include "fft.h"
#include "config.h"

#include "dsps_fft2r.h"
#include "esp_check.h"

#include <atomic>
#include <cmath>

static float fft_data[num_of_samples_per_analysis_block * 2] = {};
static size_t sample_index = 0;
static std::atomic<float> fft_energy{0.0f};

void fft_init()
{
    ESP_ERROR_CHECK(dsps_fft2r_init_fc32(nullptr, num_of_samples_per_analysis_block));
}

void write_to_fft(const uint8_t* payload, size_t length)
{
    const int16_t* samples = reinterpret_cast<const int16_t*>(payload);
    const size_t sample_count = length / sizeof(int16_t);

    for(size_t index = 0; index < sample_count; ++index)
    {
        fft_data[sample_index * 2] = samples[index] / 32768.0f;
        fft_data[sample_index * 2 + 1] = 0.0f;
        ++sample_index;

        if(sample_index == num_of_samples_per_analysis_block)
        {
            dsps_fft2r_fc32(fft_data, num_of_samples_per_analysis_block);
            dsps_bit_rev_fc32(fft_data, num_of_samples_per_analysis_block);

            float energy = 0.0f;
            for(size_t bin = 2; bin < 30; ++bin)
            {
                const float real = fft_data[bin * 2];
                const float imaginary = fft_data[bin * 2 + 1];
                energy += std::sqrt(real * real + imaginary * imaginary);
            }
            fft_energy.store(energy / 28.0f, std::memory_order_relaxed);
            sample_index = 0;
        }
    }
}

float get_fft_energy()
{
    return fft_energy.load(std::memory_order_relaxed);
}

