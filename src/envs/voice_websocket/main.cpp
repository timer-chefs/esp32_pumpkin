#include <Arduino.h>
#include <WiFi.h>
#include "web_interface.h"
#include <WebSocketsServer.h>

#include "AudioTools.h"

const char* ssid = "Pumpkin";
//const char* password = "pumpkin123";

WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// =========================
// AUDIO
// =========================

I2SStream i2s;

// Ring buffer
const int BUFFER_SIZE = 32768;

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

                if(writeIndex >= BUFFER_SIZE) {
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

    Serial.begin(115200);
    while(!Serial);

    audioBuffer = (uint8_t*)ps_malloc(BUFFER_SIZE);

    if(audioBuffer == nullptr) {
        Serial.println("PSRAM allocation failed");
        while(true);
    }

    memset(audioBuffer, 0, BUFFER_SIZE);

    WiFi.softAP(ssid);
    WiFi.setSleep(false);

    Serial.println(WiFi.softAPIP());

    web_interface_init();

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    auto config = i2s.defaultConfig(TX_MODE);

    config.sample_rate = 16000;
    config.channels = 1;
    config.bits_per_sample = 16;

    config.pin_bck = 16;
    config.pin_ws = 17;
    config.pin_data = 18;

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
        available = BUFFER_SIZE - readIndex + writeIndex;
    }

    // Write chunks to I2S
    if(available >= 512) {

        uint8_t temp[512];

        for(int i = 0; i < 512; i++) {

            temp[i] = audioBuffer[readIndex];

            readIndex++;

            if(readIndex >= BUFFER_SIZE) {
                readIndex = 0;
            }
        }

        i2s.write(temp, 512);
    }
}
