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

## Development

### Dependencies

- FlatBuffers 2.0.8 (available on [GitHub](https://github.com/google/flatbuffers/releases/v2.0.8))
- platformio (tested with 6.1.19, available through [PIP](https://pypi.org/project/platformio/))
- node (tested with v24.14.0)
- npm (tested with version 11.9.0)

### Run the client with an ESP32 backend

```sh
# Use the IP of your ESP32 device
export ESP32_HOST=...
npm --prefix frontend run dev
```

### Build the client

```sh
npm --prefix frontend run build
```

### Build the ESP32 firmware

```sh
# Builds and uploads
pio run -e application upload
# Uploads the client source code to the ESP's file system
pio run -e application uploadfs
```

### Client-server protocol contract

The browser/device WebSocket contract is defined through the FlatBuffer specification in `protocol/pumpkin.fbs`.
After changing it, use `flatc` 2.0.8 to regenerate the TypeScript and C++ bindings:

```sh
./protocol/generate.sh
```

All audio and control traffic use this contract except `/api/ip` which remains HTTP-only because it's used during bootstrapping of the WiFi provisioning page.
