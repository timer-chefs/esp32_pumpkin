#ifndef ESP32_PUMPKIN_CONFIG_H
#define ESP32_PUMPKIN_CONFIG_H

#include <Arduino.h>
#include <stdint.h>

constexpr const char* ssid = "Pumpkin";

//Event Queue
constexpr size_t max_event_queue_size = 64;


//Web server
constexpr uint8_t web_server_port = 80;
constexpr uint8_t web_socket_port = 81;

// Audio
constexpr uint16_t buffer_size = 32768;
constexpr uint16_t sample_rate = 16000;
constexpr uint8_t channels = 1;
constexpr uint8_t bits_per_sample = 16;

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

//Serial
constexpr uint32_t baud_rate = 115200;
constexpr bool enable_audio_stats_logging = false;

#endif // ESP32_PUMPKIN_CONFIG_H
