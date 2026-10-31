#ifndef FFT_H
#define FFT_H

#include <Arduino.h>


void fft_init();
void write_to_fft(const uint8_t* payload, size_t length);
float get_fft_energy();

// True once for each beat heard in the audio since the last call: a drum
// hit, a syllable, anything that suddenly gets louder in the low end. The
// audio is analysed as it is written, a little ahead of it being heard.
bool fft_take_beat();

#endif //FFT_H
