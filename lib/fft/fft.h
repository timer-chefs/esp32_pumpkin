#ifndef FFT_H
#define FFT_H

#include <cstddef>
#include <cstdint>


void fft_init();
void write_to_fft(const uint8_t* payload, size_t length);
float get_fft_energy();

#endif //FFT_H
