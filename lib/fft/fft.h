#ifndef FFT_H
#define FFT_H

#include <Arduino.h>


void fft_init();
void write_to_fft(const uint8_t* payload, size_t length);
float get_fft_energy();

#endif //FFT_H
