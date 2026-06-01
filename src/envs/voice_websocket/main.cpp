#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
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
// HTML PAGE
// =========================

const char webpage[] PROGMEM = R"rawliteral(

<!DOCTYPE html>
<html>
<head>
    <title>Pumpkin Audio</title>
</head>
<body>

<h1>Pumpkin Live Voice</h1>

<button onclick="startAudio()">
Start Microphone
</button>

<script>

let socket;

async function startAudio() {

    socket = new WebSocket("ws://" + location.hostname + ":81/");
    socket.binaryType = "arraybuffer";

    socket.onopen = async () => {

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        const audioContext = new AudioContext({
            sampleRate: 16000
        });

        const workletCode = `

        class PCMProcessor extends AudioWorkletProcessor {

            process(inputs, outputs, parameters) {

                const input = inputs[0];

                if(input.length > 0) {

                    const samples = input[0];

                    let pcm = new Int16Array(samples.length);

                    for(let i = 0; i < samples.length; i++) {

                        let s = Math.max(-1, Math.min(1, samples[i]));

                        pcm[i] = s < 0
                            ? s * 0x8000
                            : s * 0x7FFF;
                    }

                    this.port.postMessage(pcm.buffer, [pcm.buffer]);
                }

                return true;
            }
        }

        registerProcessor('pcm-processor', PCMProcessor);

        `;

        const blob = new Blob([workletCode], {
            type: 'application/javascript'
        });

        const workletURL = URL.createObjectURL(blob);

        await audioContext.audioWorklet.addModule(workletURL);

        const source =
            audioContext.createMediaStreamSource(stream);

        const processorNode =
            new AudioWorkletNode(audioContext, 'pcm-processor');

        processorNode.port.onmessage = (event) => {

            if(socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        source.connect(processorNode);

        console.log("Streaming microphone...");
    };
}

</script>

</body>
</html>

)rawliteral";

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
// HTTP
// =========================

void handleRoot() {
    server.send(200, "text/html", webpage);
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

    server.on("/", handleRoot);
    server.begin();

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

    server.handleClient();

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
