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
            currentAudioContext = audioContext;

            await audioContext.audioWorklet.addModule('/worklet_processor.js');

            const source = audioContext.createMediaStreamSource(stream);
            console.log(`Microphone AudioContext sample rate: ${audioContext.sampleRate}Hz`);
            processorNode = new AudioWorkletNode(audioContext, 'pcm-processor');
            currentProcessorNode = processorNode;

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
