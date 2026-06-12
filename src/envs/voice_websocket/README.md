# voice_websocket Environment
## Purpose:
This is the first iteration of our design.
It is meant to prototype the voice over wifi capability.

## HW Required:
* ESP32S3_DevKitC
* DAC Module: MAX98357A Module

## Expected outcome:
1) Get your phone to connect to the ESP32 HotSpot and load the page.
2) Press the "Start Microphone" button.
3) Give permission to the browser to access your mic.
4) Start talking on your phone. Your voice should be heard out of the device's speaker.

Note: Microphone access typically requires a secure context (HTTPS), so this may not work over plain http:// on many mobile browsers unless you enable a browser exception.
