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

### Presets

The presets page plays its sounds from the same directory: `ghost.wav`, `witch.wav`, `scream.wav`, `wolf.wav` and `thunder.wav`. A preset whose sound isn't on the card says so on its button. The presets themselves are defined in `frontend/src/features/presets/presets.ts`.

### Upload through the UI

You can also upload songs through the web UI that get saved to the ESP32. It will transcode the songs to the correct format for you, on the fly.

## Text to speech

The Say box on the presets page speaks whatever you type through the pumpkin. The speech is made in the browser with [Piper](https://github.com/rhasspy/piper) and streamed to the pumpkin like the microphone is.

The speech engine and voice are about 100 MB, far more than the ESP32's flash holds, so the browser downloads them from jsDelivr and Hugging Face the first time a voice is used. The phone needs internet access for that. They're kept in the browser (in IndexedDB) after that, so later visits work without downloading them again. The browser keeps them per address, though, so if the pumpkin's IP address changes they're downloaded again.

The voices to choose from are listed in `frontend/src/features/speech/voices.ts`, and any of [Piper's voices](https://github.com/rhasspy/piper/blob/master/VOICES.md) can be added there.

The Demon, Ghost and Witch effects change the voice's pitch and pace and add echo, growl or a waver to it before it's sent. They're defined, and can be tuned, in `frontend/src/features/speech/effects.ts`.

## Calibrate the eye

The Calibration page sets the angles the eye's servos move between. Drag each end of a servo's range until the eye stops where it should (far left and far right for the eye, shut and wide open for the lid), then save it. The servo moves to whichever end is being set, so you can see the angle before saving it.

The device stores the calibration in its own flash (NVS), so it survives restarts and doesn't depend on the SD card. A servo that hasn't been calibrated moves through all of 0-180°, and stays put at boot until something moves it.

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
