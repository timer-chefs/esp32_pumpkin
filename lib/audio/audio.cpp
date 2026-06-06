#include "audio.h"

#include <cstring>

#include "AudioTools.h"
#include "config.h"

static I2SStream i2s;
static uint8_t* audioBuffer = nullptr;
static volatile uint32_t writeIndex = 0;
static volatile uint32_t readIndex = 0;
static bool audioReady = false;

static uint32_t nextIndex(uint32_t index) {
    index++;
    if(index >= buffer_size) {
        index = 0;
    }
    return index;
}

bool audio_init() {
    audioBuffer = static_cast<uint8_t*>(ps_malloc(buffer_size));

    if(audioBuffer == nullptr) {
        Serial.println("PSRAM allocation failed");
        return false;
    }

    std::memset(audioBuffer, 0, buffer_size);

    auto config = i2s.defaultConfig(TX_MODE);
    config.sample_rate = sample_rate;
    config.channels = channels;
    config.bits_per_sample = bits_per_second;
    config.pin_bck = pin_bck;
    config.pin_ws = pin_ws;
    config.pin_data = pin_data;
    config.use_apll = false;

    if(!i2s.begin(config)) {
        Serial.println("I2S init failed");
        return false;
    }

    audioReady = true;
    return true;
}

void audio_write(const uint8_t* payload, size_t length) {

    for(size_t i = 0; i < length; i++) {
        audioBuffer[writeIndex] = payload[i];
        writeIndex = nextIndex(writeIndex);

        if(writeIndex == readIndex) {
            readIndex = nextIndex(readIndex);
        }
    }
}

void audioLoop() {
    if(!audioReady || audioBuffer == nullptr) {
        return;
    }

    uint32_t available;

    if(writeIndex >= readIndex) {
        available = writeIndex - readIndex;
    } else {
        available = buffer_size - readIndex + writeIndex;
    }

    if(available >= 512) {
        uint8_t temp[512];

        for(int i = 0; i < 512; i++) {
            temp[i] = audioBuffer[readIndex];
            readIndex = nextIndex(readIndex);
        }

        i2s.write(temp, 512);
    }
}
