# ESP32 Pumpkin

The firmware uses native ESP-IDF 5.5 through PlatformIO. Its hardware and
networking layers use Espressif components for I2S, FFT, LED output, HTTP,
WebSocket, Wi-Fi provisioning, mDNS, NVS, and LittleFS.

## Build and upload

```sh
./venv/bin/platformio run -e voice_websocket
./venv/bin/platformio run -e voice_websocket -t upload
./venv/bin/platformio run -e voice_websocket -t uploadfs
./venv/bin/platformio device monitor -b 115200
```

Both upload commands are required after the first ESP-IDF installation or any
partition-table change. The firmware upload does not include the filesystem;
`uploadfs` installs the compressed web application from `.littlefs`.

An uninitialized or corrupt LittleFS partition is formatted automatically so
it cannot cause a reboot loop. Until `uploadfs` is run, REST and WebSocket APIs
remain available but `/` reports that web assets are not installed.

## Wi-Fi provisioning

On first boot, or after pressing the provisioning button on GPIO 3, connect
with Espressif's ESP SoftAP Provisioning client:

- Service name: `Pumpkin-WiFi_Provisioning`
- Proof of possession: `pumpkin1`

Saved credentials are stored in NVS. If the saved network remains unavailable
for 30 seconds, the device returns to provisioning mode automatically.

## Test firmware

```sh
./venv/bin/platformio run -e test_queue
```

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
