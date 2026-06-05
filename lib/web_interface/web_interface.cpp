#include "web_interface.h"
#include "../../src/config.h"
#include <WebServer.h>

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

WebServer server(web_server_port);


void handleRoot() {
    server.send(200, "text/html", webpage);
}

void web_interface_init()
{
    server.on("/", handleRoot);
    server.begin();
}
void web_interface_loop()
{
    server.handleClient();
}
