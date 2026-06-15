#include "web_interface.h"

#include "audio.h"
#include "config.h"

#include <WebServer.h>
#include <WebSocketsServer.h>

static WebServer server(web_server_port);
static WebSocketsServer webSocket(web_socket_port);

static const char webpage[] PROGMEM = R"rawliteral(
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

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            .catch(err => { console.error(err); alert("Microphone access failed (often requires HTTPS / secure context)."); socket.close(); throw err; });

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
                        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
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

        const source = audioContext.createMediaStreamSource(stream);
        const processorNode = new AudioWorkletNode(audioContext, 'pcm-processor');

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

static void handle_root_request()
{
    server.send(200, "text/html", webpage);
}

static void web_socket_event(
    uint8_t client_num,
    WStype_t type,
    uint8_t* payload,
    size_t length)
{
    (void)client_num;
    switch(type) {
        case WStype_CONNECTED:
            Serial.println("Client connected");
            break;
        case WStype_DISCONNECTED:
            Serial.println("Client disconnected");
            break;

        case WStype_BIN:
            audio_write(payload, length);
            break;

        default:
            break;
    }
}

void web_interface_init() {
    server.on("/", handle_root_request);
    server.begin();

    webSocket.onEvent(web_socket_event);
    webSocket.begin();
    
}

void web_interface_service() {
    server.handleClient();
    webSocket.loop();
}
