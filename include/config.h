#ifndef ESP32_PUMPKIN_CONFIG_H
#define ESP32_PUMPKIN_CONFIG_H

#include <stdint.h>

constexpr const char* ssid = "Pumpkin";

//Web server
constexpr uint8_t web_server_port = 80;
constexpr uint8_t web_socket_port = 81;

// Audio
constexpr uint16_t buffer_size = 32768;
constexpr uint16_t sample_rate = 16000;
constexpr uint8_t channels = 1;
constexpr uint8_t bits_per_sample = 16;

//Pins -> Same pin numbers as the silkscreen on the ESP32S3 board.
constexpr uint8_t pin_bck = 16;
constexpr uint8_t pin_ws = 17;
constexpr uint8_t pin_data = 18;

//Serial
constexpr uint32_t baud_rate = 115200;

#endif // ESP32_PUMPKIN_CONFIG_H
