#ifndef ESP32_PUMPKIN_CONFIG_H
#define ESP32_PUMPKIN_CONFIG_H

#include <cstddef>
#include <stdint.h>

constexpr const char* wifi_provisioning_ssid = "Pumpkin-WiFi_Provisioning";
constexpr const char* mdns_hostname = "pumpkin";

//WiFi Provisioning
constexpr uint8_t pin_wifi_provisioning_btn = 3;
constexpr uint8_t wifi_provisioning_timeout = 120;
constexpr unsigned long ip_info_portal_timeout_ms = 60000;

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
constexpr uint8_t pin_led_strip = 48;
constexpr uint8_t num_leds = 2;
constexpr uint8_t max_brightness = 255;
constexpr uint16_t brightness_scaling_factor = 50;

//FFT library
constexpr uint16_t num_of_samples_per_analysis_block = 256;

//Pins -> Same pin numbers as the silkscreen on the ESP32S3 board.
//Audio Pins
constexpr uint8_t pin_bck = 16;
constexpr uint8_t pin_ws = 17;
constexpr uint8_t pin_data = 18;

//Led Pins:
constexpr uint8_t pin_led0 = 1;
constexpr uint8_t pin_led1 = 2;
constexpr uint8_t pin_led2 = 4;

//Serial
constexpr uint32_t baud_rate = 115200;
constexpr bool enable_audio_stats_logging = false;

#endif // ESP32_PUMPKIN_CONFIG_H
