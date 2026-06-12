#include "audio.h"
#include <cstring>
#include "AudioTools.h"
#include "config.h"

static I2SStream i2s;
static uint8_t* audio_buffer = nullptr;
static volatile uint32_t write_index = 0;
static volatile uint32_t read_index = 0;

static uint32_t next_index(uint32_t index) {
    index++;
    if(index >= buffer_size) {
        index = 0;
    }
    return index;
}

bool audio_init() {
    audio_buffer = static_cast<uint8_t*>(ps_malloc(buffer_size));
    if(audio_buffer == nullptr) {
        Serial.println("Audio buffer allocation failed");
        return false;
    }

    std::memset(audio_buffer, 0, buffer_size);

    auto config = i2s.defaultConfig(TX_MODE);
    config.sample_rate = sample_rate;
    config.channels = channels;
    config.bits_per_sample = bits_per_sample;
    config.pin_bck = pin_bck;
    config.pin_ws = pin_ws;
    config.pin_data = pin_data;
    config.use_apll = false;

    if(!i2s.begin(config)) {
        Serial.println("I2S begin failed");
        return false;
    }

    return true;
}

void audio_write(const uint8_t* payload, size_t length) {

    for(size_t i = 0; i < length; i++) {
        audio_buffer[write_index] = payload[i];
        write_index = next_index(write_index);

        if(write_index == read_index) {
            read_index = next_index(read_index);
        }
    }
}

void audio_service() {
    uint32_t available;

    if(write_index >= read_index) {
        available = write_index - read_index;
    } else {
        available = buffer_size - read_index + write_index;
    }

    if(available >= 512) {
        uint8_t temp[512];

        for(int i = 0; i < 512; i++) {
            temp[i] = audio_buffer[read_index];
            read_index = next_index(read_index);
        }

        i2s.write(temp, 512);
    }
}
