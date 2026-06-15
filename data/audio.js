let socket;

async function startAudio() {
    try {
        socket = new WebSocket("ws://" + location.hostname + ":81/");
        socket.binaryType = "arraybuffer";

        socket.onopen = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                .catch(err => { 
                    console.error(err); 
                    alert("Microphone access failed (often requires HTTPS / secure context)."); 
                    socket.close(); 
                    throw err; 
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
            const processorNode = new AudioWorkletNode(audioContext, 'pcm-processor');

            processorNode.port.onmessage = (event) => {
                if(socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            };

            source.connect(processorNode);

            console.log("Streaming microphone...");
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        socket.onclose = () => {
            console.log("WebSocket closed");
        };
    } catch (err) {
        console.error("Error:", err);
    }
}
