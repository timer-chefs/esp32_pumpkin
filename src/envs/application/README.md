# application Environment
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

The application uses HTTPS/WSS with a device-generated self-signed certificate.
Accept the browser's certificate warning before using microphone streaming. The
WiFi provisioning portal remains on HTTP and redirects to HTTPS after setup.

## LittleFS
We are using LittleFS to create a lightweight filesystem in the MCU. This helps organize and store the webpage in different files in the folder `./data`. Then it is converted into a binary that is later uploaded into the microcontroller.

### Command to create the binary.
```
pio run -t buildfs -e application
```
> NOTE: Any environment works

### Command to upload the binary to the MCU.
```
pio run -t uploadfs -e application
```
> NOTE: Any environment works.
