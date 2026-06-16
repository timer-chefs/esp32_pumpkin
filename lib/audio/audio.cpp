#include "audio.h"
#include <cstring>
#include "AudioTools.h"
#include "config.h"

static I2SStream i2s;
static uint8_t* audio_buffer = nullptr;
static volatile uint32_t write_index = 0;
static volatile uint32_t read_index = 0;
static volatile uint32_t bytes_written = 0;
static volatile uint32_t bytes_received = 0;
static volatile uint32_t overrun_count = 0;
static volatile uint32_t underrun_count = 0;
static bool playback_started = false;
static constexpr size_t i2s_chunk_size = 512;
static constexpr size_t playback_start_threshold = 4096;
static uint32_t last_stats_millis = 0;
static uint32_t last_stats_bytes_received = 0;
static uint32_t last_stats_bytes_written = 0;

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
    config.use_apll = true;  // Use APLL for better accuracy
    config.fixed_mclk = 0;   // Auto calculate MCLK
    config.buffer_size = 512;    // DMA buffer size in samples
    config.buffer_count = 4;     // Number of DMA buffers

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
            overrun_count++;
            read_index = next_index(read_index);
        }
    }
    bytes_received += length;
}

void audio_service() {
    uint32_t available;

    if(write_index >= read_index) {
        available = write_index - read_index;
    } else {
        available = buffer_size - read_index + write_index;
    }

    if(!playback_started) {
        if(available < playback_start_threshold) {
            return;
        }
        playback_started = true;
    }

    // Wait for a modest prebuffer to absorb Wi-Fi jitter before starting,
    // then keep draining fixed-size chunks into the I2S DMA engine.
    if(available >= i2s_chunk_size && i2s.availableForWrite() >= static_cast<int>(i2s_chunk_size)) {
        uint8_t temp[i2s_chunk_size];

        for(size_t i = 0; i < i2s_chunk_size; i++) {
            temp[i] = audio_buffer[read_index];
            read_index = next_index(read_index);
        }

        size_t written = i2s.write(temp, i2s_chunk_size);
        if(written > 0) {
            bytes_written += written;
        }
    } else if(available < i2s_chunk_size && playback_started) {
        underrun_count++;
    }

    if(available == 0) {
        playback_started = false;
    }
}

void audio_reset() {
    // Clear buffer and reset indices for new stream
    std::memset(audio_buffer, 0, buffer_size);
    write_index = 0;
    read_index = 0;
    bytes_written = 0;
    bytes_received = 0;
    overrun_count = 0;
    underrun_count = 0;
    playback_started = false;
    last_stats_millis = millis();
    last_stats_bytes_received = 0;
    last_stats_bytes_written = 0;
    Serial.println("Audio buffer reset");
}

void audio_log_stats() {
    const uint32_t now = millis();
    if(now - last_stats_millis < 1000) {
        return;
    }

    uint32_t buffered;
    if(write_index >= read_index) {
        buffered = write_index - read_index;
    } else {
        buffered = buffer_size - read_index + write_index;
    }

    const uint32_t rx_delta = bytes_received - last_stats_bytes_received;
    const uint32_t tx_delta = bytes_written - last_stats_bytes_written;

    Serial.printf(
        "audio stats: buffered=%lu rx=%luB/s tx=%luB/s i2s_free=%d started=%d overruns=%lu underruns=%lu\n",
        static_cast<unsigned long>(buffered),
        static_cast<unsigned long>(rx_delta),
        static_cast<unsigned long>(tx_delta),
        i2s.availableForWrite(),
        playback_started ? 1 : 0,
        static_cast<unsigned long>(overrun_count),
        static_cast<unsigned long>(underrun_count)
    );

    last_stats_millis = now;
    last_stats_bytes_received = bytes_received;
    last_stats_bytes_written = bytes_written;
}
