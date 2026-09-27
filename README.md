# ESP32 Pumpkin

## Hardware

See [hardware/](hardware/) for the bill of materials and schematic.

## Transfer songs to the SD card

If you place songs in the `/audio` directory on the SD card then they can be played "offline" without buffering. They will be listed in the UI.

Only `.wav` files are listed, and should optimally be 16-bit PCM (mono or stereo) and 16kHz. Other sample rates work (8 - 48 kHz) but have to be resampled on the fly.

You can encode a file with the expected format with the following command:

```bash
ffmpeg -i song.mp3 -ac 1 -ar 16000 -c:a pcm_s16le song.wav
```

### Upload through the UI

You can also upload songs through the web UI that get saved to the ESP32. It will transcode the songs to the correct format for you, on the fly.

## Development

### Dependencies

- FlatBuffers 25.9.23 (available on [GitHub](https://github.com/google/flatbuffers/releases/v25.9.23))
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
pio run -d firmware -e application upload
# Uploads the client source code to the ESP's file system
pio run -d firmware -e application uploadfs
```

### Client-server protocol contract

The browser/device WebSocket contract is defined through the FlatBuffer specification in `protocol/pumpkin.fbs`.
After changing it, use `flatc` 25.9.23 to regenerate the TypeScript and C++ bindings:

```sh
./protocol/generate.sh
```

All audio and control traffic use this contract except `/api/ip` which remains HTTP-only because it's used during bootstrapping of the WiFi provisioning page.
