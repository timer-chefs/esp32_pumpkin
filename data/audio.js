import
{
    mixToMono,
    resampleAudioHighQuality,
    convertFloatToInt16
} from './audio_file_utils.js';

import
{
    showMicrophoneMode,
    hideMicrophoneMode,
    showFileMode,
    setFileStatus,
    clearFileStatus,
    setStreamFileEnabled
} from './audio_ui.js';

let socket;
let currentStream = null;
let selectedFile = null;
let isStreaming = false;
let currentAudioContext = null;
let currentProcessorNode = null;

// ============ MICROPHONE MODE ============
async function switchToMicrophone() {
    stopAudio();
    showMicrophoneMode();
    
    try {
        const ws = new WebSocket("ws://" + location.hostname + ":81/");
        socket = ws;
        ws.binaryType = "arraybuffer";
        let audioContext = null;
        let processorNode = null;

        ws.onopen = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                .catch(err => { 
                    console.error(err); 
                    alert("Microphone access failed."); 
                    ws.close(); 
                    throw err; 
                });

            currentStream = stream;

            audioContext = new AudioContext({
                sampleRate: 16000
            });
            currentAudioContext = audioContext;

            await audioContext.audioWorklet.addModule('/worklet_processor.js');

            const source = audioContext.createMediaStreamSource(stream);
            console.log(`Microphone AudioContext sample rate: ${audioContext.sampleRate}Hz`);
            processorNode = new AudioWorkletNode(audioContext, 'pcm-processor');
            currentProcessorNode = processorNode;

            processorNode.port.onmessage = (event) => {
                if(ws.readyState === WebSocket.OPEN) {
                    ws.send(event.data);
                }
            };

            source.connect(processorNode);
            isStreaming = true;
            console.log("Streaming microphone...");
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            console.log("WebSocket closed");
            if(processorNode) {
                processorNode.port.onmessage = null;
            }
            isStreaming = false;
        };
    } catch (err) {
        console.error("Error:", err);
        document.getElementById('btn-microphone').disabled = false;
    }
}

function stopMicrophone() {
    stopAudio();
    hideMicrophoneMode();
}

// ============ FILE MODE ============
function switchToFile() {
    stopAudio();
    showFileMode();
}

function onFileSelected(event) {
    selectedFile = event.target.files[0];
    if(selectedFile)
    {
        const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(2);
        setFileStatus(`<p>Selected: <strong>${selectedFile.name}</strong> (${sizeMB} MB)</p>`);
        setStreamFileEnabled(true);
    } else
    {
        clearFileStatus();
        setStreamFileEnabled(false);
    }
}

async function streamSelectedFile() {
    if(!selectedFile) {
        alert("Please select an audio file first");
        return;
    }

    // Request to reset audio buffer before streaming
    try {
        await fetch('/api/audio/reset');
    } catch(err) {
        console.warn("Could not reset audio buffer:", err);
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await selectedFile.arrayBuffer();
    
    // Decode audio to PCM 16-bit
    try {
        const audioContext = new (window.AudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        console.log(`Audio decoded`);
        
        let monoData = mixToMono(audioBuffer);
        
        const sampleRate = audioBuffer.sampleRate;
        
        // Resample to 16000 Hz if needed (typical for I2S on ESP32)
        const targetSampleRate = 16000;
        let resampledData;
        
        if(sampleRate === targetSampleRate) {
            resampledData = monoData;
        } else {
            resampledData = resampleAudioHighQuality(monoData,
                sampleRate,
                targetSampleRate);
        }

        const {int16Data, peak} = convertFloatToInt16(resampledData);
        console.log(`Converted to Int16: ${int16Data.length} samples, peak level: ${(peak * 100).toFixed(1)}%`);
        if(peak < 0.1)
        {
            console.warn("⚠️ Warning: Audio level very quiet (peak < 10%). File might be silent or very compressed.");
        }

        // Open WebSocket and stream
        await streamAudioData(int16Data.buffer);
        
    } catch(err) {
        console.error("Error processing audio:", err);
        alert("Failed to process audio file. Make sure it's a valid audio file.");
    }
}



async function streamAudioData(audioBuffer) {
    return new Promise((resolve, reject) => {
        socket = new WebSocket("ws://" + location.hostname + ":81/");
        socket.binaryType = "arraybuffer";
        
        let bytesSent = 0;
        const startTime = Date.now();

        socket.onopen = () => {
            const chunkSize = 512; // Match I2S write size for better timing
            const bytesPerSecond = 16000 * 2;
            const bytesPerMillisecond = bytesPerSecond / 1000;
            const data = new Uint8Array(audioBuffer);
            let offset = 0;
            let updateCount = 0;

            console.log(`Starting stream: ${data.length} bytes (${(data.length / 2)} Int16 samples)`);
            setFileStatus('<p>Streaming...</p>');

            const streamChunk = () => {
                if(offset < data.length && socket.readyState === WebSocket.OPEN && isStreaming) {
                    const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
                    socket.send(chunk);
                    offset += chunkSize;
                    bytesSent += chunk.length;
                    
                    // Update progress every 50 chunks
                    if(updateCount++ % 50 === 0) {
                        const progress = Math.round((offset / data.length) * 100);
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        setFileStatus(`<p>Streaming: ${progress}% (${bytesSent} bytes, ${elapsed}s)</p>`);
                    }
                    
                    // Pace to the actual playback rate so latency does not keep growing.
                    const elapsedMs = Date.now() - startTime;
                    const targetElapsedMs = bytesSent / bytesPerMillisecond;
                    const delayMs = Math.max(0, Math.round(targetElapsedMs - elapsedMs));
                    setTimeout(streamChunk, delayMs);
                } else if(offset >= data.length) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`✓ Streaming complete! ${bytesSent} bytes in ${elapsed}s`);
                    setFileStatus(`<p style="color: green;">Complete! (${bytesSent} bytes in ${elapsed}s)</p>`);
                    isStreaming = false;
                    
                    // Keep socket open a bit longer to ensure all data is played
                    setTimeout(() => {
                        if(socket.readyState === WebSocket.OPEN) {
                            socket.close();
                        }
                        resolve();
                    }, 500);
                }
            };

            isStreaming = true;
            streamChunk();
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            isStreaming = false;
            reject(error);
        };

        socket.onclose = () => {
            console.log("WebSocket closed after streaming");
            isStreaming = false;
        };
    });
}

function stopAudio() {
    isStreaming = false;
    
    if(currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    if(currentProcessorNode) {
        currentProcessorNode.port.onmessage = null;
        currentProcessorNode.disconnect();
        currentProcessorNode = null;
    }

    if(currentAudioContext) {
        currentAudioContext.close().catch(() => {});
        currentAudioContext = null;
    }
    
    if(socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    socket = null;
    
    clearFileStatus();
    
    // Also try to reset buffer when stopping
    try {
        fetch('/api/audio/reset').catch(() => {});
    } catch(err) {
        // Ignore errors
    }
}

window.switchToMicrophone = switchToMicrophone;
window.stopMicrophone = stopMicrophone;
window.switchToFile = switchToFile;
window.onFileSelected = onFileSelected;
window.streamSelectedFile = streamSelectedFile;
window.stopAudio = stopAudio;
