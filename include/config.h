#ifndef ESP32_PUMPKIN_CONFIG_H
#define ESP32_PUMPKIN_CONFIG_H

#include <Arduino.h>
#include <stdint.h>

constexpr const char* wifi_provisioning_ssid = "Pumpkin-WiFi_Provisioning";
constexpr const char* mdns_hostname = "pumpkin";

//WiFi Provisioning
constexpr uint8_t wifi_provisioning_timeout = 120; // seconds
constexpr unsigned long ip_info_portal_timeout_ms = 60000;

//Web server
constexpr uint8_t web_server_port = 80;
constexpr uint8_t web_socket_port = 81;
// Audio-chunk frames and command frames (e.g. a button press) share one
// websocket connection, and the library only dequeues one queued frame per
// call. Drain up to this many per loop() iteration so a backlog of audio
// frames doesn't delay a command frame queued behind them.
constexpr uint8_t max_websocket_frames_per_loop = 8;
// Initial size of the response FlatBuffer. Big enough for a full audio file
// listing, and the builder grows on its own if that ever isn't enough.
constexpr uint16_t response_builder_size = 2048;
// Upper bound on the commands feature libraries can register between them.
constexpr uint8_t max_registered_commands = 24;
// ...and on the commands that answer after the fact.
constexpr uint8_t max_registered_completions = 4;
// Largest chunk of streamed audio a client may send in one message.
constexpr uint16_t max_audio_chunk_size = 512;

// Audio
constexpr uint16_t buffer_size = 32768;
constexpr uint16_t sample_rate = 16000;
constexpr uint8_t channels = 1;
constexpr uint8_t bits_per_sample = 16;

// If the amount of buffered-but-not-yet-played audio grows past this, the
// device starts trimming small slices off the oldest buffered audio on
// every playback chunk to catch back up, instead of letting playback lag
// behind forever.
constexpr uint16_t audio_catch_up_high_water_ms = 100;
// ...and keeps trimming until buffered audio drops back down to this level.
constexpr uint16_t audio_catch_up_low_water_ms = 50;
// How much to trim per playback chunk while catching up. Small enough to be
// inaudible as an individual drop.
constexpr uint16_t audio_catch_up_step_ms = 4;
// Each trim is blended across this many ms rather than cut outright, so the
// audio right before the cut is cross-faded into the audio right after it
// instead of jumping straight from one waveform to the other (which is what
// causes an audible click/pop).
constexpr uint16_t audio_catch_up_crossfade_ms = 3;

// LED strip
constexpr uint8_t pin_led_strip = GPIO_NUM_48;
constexpr uint8_t num_leds = 2;
constexpr uint8_t max_brightness = 255;
constexpr uint16_t brightness_scaling_factor = 50;

//FFT library
constexpr uint16_t num_of_samples_per_analysis_block = 256;

//Pins -> Same pin numbers as the silkscreen on the ESP32S3 board.
//Audio Pins
constexpr uint8_t pin_bck = GPIO_NUM_16;
constexpr uint8_t pin_ws = GPIO_NUM_17;
constexpr uint8_t pin_data = GPIO_NUM_18;

//Led Pins:
constexpr uint8_t pin_led0 = GPIO_NUM_1;
constexpr uint8_t pin_led1 = GPIO_NUM_2;
constexpr uint8_t pin_led2 = GPIO_NUM_4;

//WiFi Provisioning Pins:
constexpr uint8_t pin_wifi_provisioning_btn = GPIO_NUM_1;

// SDMMC_FREQ_HIGHSPEED, which is also what the Arduino core picks for this
// board by default. Playback only needs 32 kB/s; the speed is worth having
// for uploads, which the device reads back in full to verify. Lower it if a
// card proves unreliable -- `pio run -e test_sd_read` reports what a given
// card and clock actually manage.
constexpr int sd_card_frequency_khz = 40000;

// SD card audio library
// Audio files live in their own directory on the card so the listing isn't
// polluted by whatever else the card happens to carry.
constexpr const char* sd_audio_directory = "/audio";
constexpr uint8_t max_listed_audio_files = 32;
constexpr uint8_t max_file_name_length = 64;
// Room for "<sd_audio_directory>/<file name>".
constexpr uint8_t audio_path_length = max_file_name_length + 32;
// How much SD-sourced audio to keep buffered ahead of playback. Kept below
// audio_catch_up_high_water_ms so topping the buffer up never looks like a
// network burst to the catch-up logic.
constexpr uint16_t sd_audio_target_buffer_ms = 60;
// How much of the file to read from the card at a time. Must be a whole
// number of sectors, so the driver can DMA straight into the read buffer.
constexpr uint16_t sd_audio_read_block_size = 1024;
constexpr uint32_t sd_sector_size = 512;
// The SD driver rejects a buffer for DMA unless it is aligned to the cache
// line, and falls back to allocating a bounce buffer for every transfer.
constexpr size_t sd_dma_alignment = 64;
// How many times to remount and resume before giving up on a file.
constexpr uint8_t max_sd_read_recoveries = 3;
// How much of an uploaded file to read back per turn round loop(). Small
// enough that playback and the web socket don't notice it.
constexpr uint32_t sd_verify_bytes_per_service = 8192;
// Largest upload chunk the device accepts. The client acknowledges its way
// through a file a couple of chunks at a time, so this also caps how much of
// an upload can be in flight anywhere between the browser and the card.
constexpr uint16_t max_upload_chunk_size = 2048;
// An upload in progress writes here, and only takes its real name once every
// byte has arrived, so an interrupted upload can't leave a half file behind.
// The leading dot keeps it out of the listing.
constexpr const char* sd_upload_temporary_file = ".upload.tmp";

// SDIO Pin 
constexpr uint8_t pin_sd_clk = GPIO_NUM_12;
constexpr uint8_t pin_sd_cmd = GPIO_NUM_11;
constexpr uint8_t pin_sd_d0 = GPIO_NUM_13;
constexpr uint8_t pin_sd_d1 = GPIO_NUM_14;
constexpr uint8_t pin_sd_d2 = GPIO_NUM_9;
constexpr uint8_t pin_sd_d3 = GPIO_NUM_10;

//Serial
constexpr uint32_t baud_rate = 115200;
constexpr bool enable_audio_stats_logging = false;

#endif // ESP32_PUMPKIN_CONFIG_H
