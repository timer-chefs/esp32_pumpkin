#include <Arduino.h>
#include "config.h"
#include <WiFi.h>
#include "web_interface.h"
#include <WebSocketsServer.h>

#include "AudioTools.h"


WebSocketsServer webSocket = WebSocketsServer(web_socket_port);

// =========================
// AUDIO
// =========================

I2SStream i2s;

uint8_t* audioBuffer;

volatile uint32_t writeIndex = 0;
volatile uint32_t readIndex = 0;

// =========================
// WEBSOCKET
// =========================

void webSocketEvent(uint8_t client_num,
                    WStype_t type,
                    uint8_t * payload,
                    size_t length) {

    switch(type) {

        case WStype_CONNECTED:

            Serial.println("Client connected");

            break;

        case WStype_DISCONNECTED:

            Serial.println("Client disconnected");

            break;

        case WStype_BIN:

            // Push incoming audio into ring buffer
            for(size_t i = 0; i < length; i++) {

                audioBuffer[writeIndex] = payload[i];

                writeIndex++;

                if(writeIndex >= buffer_size) {
                    writeIndex = 0;
                }
            }

            break;

        default:
            break;
    }
}

// =========================
// SETUP
// =========================

void setup() {

    Serial.begin(baud_rate);
    while(!Serial);

    audioBuffer = (uint8_t*)ps_malloc(buffer_size);

    if(audioBuffer == nullptr) {
        Serial.println("PSRAM allocation failed");
        while(true);
    }

    memset(audioBuffer, 0, buffer_size);

    WiFi.softAP(ssid);
    WiFi.setSleep(false);

    Serial.println(WiFi.softAPIP());

    web_interface_init();

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    auto config = i2s.defaultConfig(TX_MODE);

    config.sample_rate = sample_rate;
    config.channels = channels;
    config.bits_per_sample = bits_per_second;

    config.pin_bck = pin_bck;
    config.pin_ws = pin_ws;
    config.pin_data = pin_data;
    config.use_apll = false;

    if(!i2s.begin(config)) {
        Serial.println("I2S init failed");
        while(true);
    }

    Serial.println("System ready");
}

// =========================
// LOOP
// =========================

void loop() {

    web_interface_loop();

    webSocket.loop();

    // Available bytes in buffer
    int available;

    if(writeIndex >= readIndex) {
        available = writeIndex - readIndex;
    } else {
        available = buffer_size - readIndex + writeIndex;
    }

    // Write chunks to I2S
    if(available >= 512) {

        uint8_t temp[512];

        for(int i = 0; i < 512; i++) {

            temp[i] = audioBuffer[readIndex];

            readIndex++;

            if(readIndex >= buffer_size) {
                readIndex = 0;
            }
        }

        i2s.write(temp, 512);
    }
}
