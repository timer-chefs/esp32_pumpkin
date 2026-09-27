# Hardware

The Fritzing source for the images below is [esp32_pumpkin.fzz](./esp32_pumpkin.fzz).

## Bill of materials

Qty | Part | Notes
---|---|---
1 | ESP32-S3-DevKitC-1 (dual USB) |
1 | PCM5102A I2S DAC module |
1 | microSD breakout with all SDIO pins broken out | Preferably one that exposes D1-D3 to get better bandwidth during file uploads
1 | WS2812B LED strip |
1 | Push button | WiFi provisioning
3 | 220 Ω resistor (0805) | Series resistors on the LED strip and servo signal lines
3 | 3-pin polarized connector | LED strip, servo 1, servo 2
2 | 2-pin polarized connector | DAC left/right audio out
4 | 2-pin screw terminal | 12 V in, 12 V to amplifier, 12 V to converter, 5 V in
1 | 9-pin female header | SD card breakout
4 | Stand-off |
1 | Perfboard |

Not on the board:

Qty | Part | Notes
---|---|---
1 | 12 V LiFePO4 battery | We use a 5 Ah one from DCHOUSE
1 | 12 V to 5 V DC-DC converter | Feeds the 5 V terminal. We use a GYVRM K240505 (25 W)
1 | Amplifier board | Must take 12 V in. We use TPA3116 rated for ~120 W
1 | Speaker | We use ~10 W; a more powerful one plays louder

## Schematic

![schematic](./esp32_pumpkin_schem.svg)

## Protoboard

![protoboard](./esp32_pumpkin_bb.svg)

## Wiring notes

The DAC is powered from 3.3 V. Two of its pins are tied off rather than driven:

- **SCK to GND**, so the module generates its own system clock from BCK.
- **XSMT to 3.3 V**, which keeps the output unmuted.

The LED strip and servos are powered from the 5 V terminal, not from the ESP32.
