# ESP32 Pumpkin

## Pinout

### Audio (PCM5102A DAC)

ESP32-S3 Pin | PCM5102A Pin | Notes
---|---|---
GPIO 16 | BCK | Bit Clock
GPIO 17 | LCK | Left/Right Clock (Word Select)
GPIO 18 | DIN | Data In
GND | GND | Ground
\- | SCK | Leave floating
3.3V | VIN | Most modules have an onboard regulator
3.3V | XSMT | Un-mute

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

### WiFi Provisioning Button
This button triggeres the wifi provisioning functionality. This allows the user to change the network to which the system connects to.

ESP32-S3 Pin | Connection
--- | ---
GPIO 3 (internal pull-up) | Button pin 1
GND | Button pin 2
