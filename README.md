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

The presets are kept in `presets.csv` at the root of the SD card, so a card carries its presets along with the sounds they play. Back them up by copying the file off the card. It can be edited on a computer too, in a spreadsheet or a text editor.

The first line names the columns, which can come in any order:

| Column  | What it holds                                                                          |
| ------- | -------------------------------------------------------------------------------------- |
| `name`  | The name on the preset's button.                                                       |
| `icon`  | The name of one of [Lucide's icons](https://lucide.dev/icons), like `cloud-lightning`. |
| `light` | `candle`, `audio_reactive`, or `none` to leave the lights as they are.                 |
| `color` | The light's color, as `#rrggbb`.                                                       |
| `sound` | A `.wav` file in `/audio`, or empty to play nothing.                                   |
| `eye`   | `none`, `wander`, `shifty`, `stare` or `sleep`.                                        |

```csv
name,icon,light,color,sound,eye
Ghost,ghost,audio_reactive,#8000ff,ghost.wav,wander
Candles,flame,candle,#ffa500,,sleep
```

Anything in the file that can't be read is pointed out on the presets page, and the rest of it still loads.

A preset's icon can be any of Lucide's. The page carries a few of them itself (they're listed in `presetIcons` in `frontend/src/features/presets/presets.ts`) and fetches the rest from jsDelivr, so those need the phone to have internet. Without it, they show as a question mark.

The presets can also be edited in the UI, from the Edit button under More. The changes stay in the editor until Save writes them to the card. Saving keeps the file it replaces as `presets.bak.csv`. If the presets haven't changed, neither file is touched, so the backup always holds the last presets that were different.

A card without `presets.csv` starts with no presets; add them in the editor. A preset whose sound isn't on the card says so on its button.

### Upload through the UI

You can also upload songs through the web UI that get saved to the ESP32. It will transcode the songs to the correct format for you, on the fly.

## Usage

### Calibrate the eye

The Calibration page sets the angles the eye's servos move between. Drag each end of a servo's range until the eye stops where it should (far left and far right for the eye, shut and wide open for the lid), then save it.

A servo that hasn't been calibrated moves through all of 0-180°.

### Text to speech

The speech engine and voice are about 100 MB, far more than the ESP32's flash holds, so the browser downloads them from jsDelivr and Hugging Face the first time a voice is used. The phone needs internet access for that. They're kept in the browser (in IndexedDB) after that, so later visits work without downloading them again. The browser keeps them per address, though, so if the pumpkin's IP address changes they're downloaded again.

### Voice effects

The voice effect picked on the presets page (Demon, Ghost or Witch) is used both for the Say box and for "Hold to talk". It changes the voice's pitch and adds echo, growl or a waver to it before it's sent. The Say box also changes the pace, which a live voice can't have. The effects are defined, and can be tuned, in `frontend/src/features/voice_effect/effects.ts`.

### Auto mode

"Auto mode" on the presets page leaves the pumpkin to play the presets in `presets.csv` that have a sound by itself, in a random order, with a random pause after each, picked next to it. Every preset gets a turn before any comes round again. The file is read afresh for each round, so presets saved in the editor play from the next round on.

It runs on the pumpkin until "Auto mode" is pressed again or something is played by hand -- a preset, a file, a voice. It carries on with the phone locked or the page closed, and after the pumpkin restarts. A card without `presets.csv` gives it nothing to play, so make some presets in the editor first.

While a preset plays, the eye glances to a random spot on the beat, more or less: the pumpkin listens for sudden rises in the low end of what it plays, like drum hits or syllables. It leaves the eye alone until it has been calibrated.

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

### Upgrade Lucide

The presets page fetches most of its icons from jsDelivr, pinned in `frontend/src/features/presets/icon_set_slice.ts` to the version of `lucide-react` it's built with, along with a checksum the browser holds the file to. After upgrading `lucide-react`, put its version there, along with the checksum of that version's `icon-nodes.json` as npm has it. The checksum goes after `sha384-`:

```sh
npm pack lucide-static@<version>
tar -xzOf lucide-static-<version>.tgz package/icon-nodes.json | openssl dgst -sha384 -binary | openssl base64 -A
```

A test fails until the two versions match.

### Client-server protocol contract

The browser/device WebSocket contract is defined through the FlatBuffer specification in `protocol/pumpkin.fbs`.
After changing it, use `flatc` 25.9.23 to regenerate the TypeScript and C++ bindings:

```sh
./protocol/generate.sh
```

All audio and control traffic use this contract except two HTTP-only endpoints:

- `/api/ip`, because it's used during bootstrapping of the WiFi provisioning page.
- `/api/presets`, because a WebSocket message can't be larger than 15 kB. `GET` returns `presets.csv` from the SD card (404 when there isn't one) and `PUT` replaces it. Its format belongs to the client; the device only reads the columns auto mode needs.
