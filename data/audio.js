let socket;
let currentStream = null;
let selectedFile = null;
let isStreaming = false;
let currentAudioContext = null;
let currentProcessorNode = null;

// ============ MICROPHONE MODE ============
async function switchToMicrophone() {
    stopAudio();
    document.getElementById('microphone-section').style.display = 'block';
    document.getElementById('file-section').style.display = 'none';
    document.getElementById('btn-microphone').disabled = true;
    document.getElementById('btn-file').disabled = false;
    
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
    document.getElementById('microphone-section').style.display = 'none';
    document.getElementById('btn-microphone').disabled = false;
}

// ============ FILE MODE ============
function switchToFile() {
    stopAudio();
    document.getElementById('file-section').style.display = 'block';
    document.getElementById('btn-file').disabled = true;
    document.getElementById('btn-microphone').disabled = false;
}

function onFileSelected(event) {
    selectedFile = event.target.files[0];
    if(selectedFile) {
        const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(2);
        document.getElementById('file-status').innerHTML = 
            `<p>Selected: <strong>${selectedFile.name}</strong> (${sizeMB} MB)</p>`;
        document.getElementById('btn-stream').disabled = false;
    } else {
        document.getElementById('file-status').innerHTML = '';
        document.getElementById('btn-stream').disabled = true;
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
        
        console.log(`Audio decodedd`);
        
        // Handle multiple channels - mix down to mono if needed
        let monoData;
        if(audioBuffer.numberOfChannels === 1) {
            monoData = audioBuffer.getChannelData(0);
        } else if(audioBuffer.numberOfChannels === 2) {
            // Mix stereo to mono
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            monoData = new Float32Array(left.length);
            for(let i = 0; i < left.length; i++) {
                monoData[i] = (left[i] + right[i]) * 0.5;
            }
        } else {
            // For multi-channel, just use first channel
            monoData = audioBuffer.getChannelData(0);
        }
        
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
        
        // Convert float to Int16 with dithering for better quality
        const int16Data = new Int16Array(resampledData.length);
        let peak = 0;
        
        for(let i = 0; i < resampledData.length; i++) {
            let s = Math.max(-1, Math.min(1, resampledData[i]));
            
            // Add tiny dither noise to reduce quantization artifacts
            const dither = (Math.random() - 0.5) * 0.0001;
            s = Math.max(-1, Math.min(1, s + dither));
            
            const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
            int16Data[i] = int16;
            peak = Math.max(peak, Math.abs(s));
        }
        
        console.log(`Converted to Int16: ${int16Data.length} samples, peak level: ${(peak * 100).toFixed(1)}%`);
        
        if(peak < 0.1) {
            console.warn("⚠️ Warning: Audio level very quiet (peak < 10%). File might be silent or very compressed.");
        }
        
        // Open WebSocket and stream
        await streamAudioData(int16Data.buffer);
        
    } catch(err) {
        console.error("Error processing audio:", err);
        alert("Failed to process audio file. Make sure it's a valid audio file.");
    }
}

function resampleAudioHighQuality(data, fromSampleRate, toSampleRate) {
    if(fromSampleRate === toSampleRate) return data;
    
    const ratio = toSampleRate / fromSampleRate;
    const newLength = Math.round(data.length * ratio);
    const result = new Float32Array(newLength);
    
    // Use cubic interpolation for better quality
    for(let i = 0; i < newLength; i++) {
        const index = i / ratio;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        
        if(upper >= data.length) {
            result[i] = data[lower] || 0;
        } else if(lower === upper) {
            result[i] = data[lower];
        } else {
            // Linear interpolation (simpler but effective)
            result[i] = data[lower] * (1 - weight) + data[upper] * weight;
        }
    }
    
    return result;
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
            document.getElementById('file-status').innerHTML = '<p>Streaming...</p>';

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
                        document.getElementById('file-status').innerHTML = 
                            `<p>Streaming: ${progress}% (${bytesSent} bytes, ${elapsed}s)</p>`;
                    }
                    
                    // Pace to the actual playback rate so latency does not keep growing.
                    const elapsedMs = Date.now() - startTime;
                    const targetElapsedMs = bytesSent / bytesPerMillisecond;
                    const delayMs = Math.max(0, Math.round(targetElapsedMs - elapsedMs));
                    setTimeout(streamChunk, delayMs);
                } else if(offset >= data.length) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`✓ Streaming complete! ${bytesSent} bytes in ${elapsed}s`);
                    document.getElementById('file-status').innerHTML = 
                        `<p style="color: green;">Complete! (${bytesSent} bytes in ${elapsed}s)</p>`;
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
    
    document.getElementById('file-status').innerHTML = '';
    
    // Also try to reset buffer when stopping
    try {
        fetch('/api/audio/reset').catch(() => {});
    } catch(err) {
        // Ignore errors
    }
}
