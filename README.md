# ESP32 Pumpkin

## Pinout

### Audio (PCM5102A DAC)

ESP32-S3 Pin | PCM5102A Pin | Notes
---|---|---
GPIO 16 | BCK | Bit Clock
GPIO 17 | LCK | Left/Right Clock (Word Select)
GPIO 18 | DIN | Data In
GND | GND | Ground
GND | SCK | Tie to GND (uses internal PLL for master clock)
3.3V / 5V | VIN | Most modules have an onboard regulator

### LED Strip

ESP32-S3 Pin | Connection
---|---
GPIO 48 | LED Strip Data

### Status LEDs

ESP32-S3 Pin | Connection
---|---
GPIO 1 | LED 0
GPIO 2 | LED 1
GPIO 4 | LED 2
