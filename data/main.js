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

import
{
    createAudioSocket,
    isSocketOpen,
    closeAudioSocket
} from './audio_socket.js';

import
{
    audioState,
    resetAudioState
} from "./audio_state.js";

import
{
    switchToMicrophone,
    stopMicrophone
} from "./mic_controller.js";

import { stopAudio } from "./audio_cleanup.js";

// ============ FILE MODE ============
function switchToFile() {
    stopAudio();
    showFileMode();
}

function onFileSelected(event) {
    audioState.selectedFile = event.target.files[0];
    if(audioState.selectedFile)
    {
        const sizeMB = (audioState.selectedFile.size / 1024 / 1024).toFixed(2);
        setFileStatus(`<p>Selected: <strong>${audioState.selectedFile.name}</strong> (${sizeMB} MB)</p>`);
        setStreamFileEnabled(true);
    } else
    {
        clearFileStatus();
        setStreamFileEnabled(false);
    }
}

async function streamSelectedFile() {
    if(!audioState.selectedFile) {
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
    const arrayBuffer = await audioState.selectedFile.arrayBuffer();
    
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
        audioState.socket = createAudioSocket(location.hostname);
        
        let bytesSent = 0;
        const startTime = Date.now();

        audioState.socket.onopen = () => {
            const chunkSize = 512; // Match I2S write size for better timing
            const bytesPerSecond = 16000 * 2;
            const bytesPerMillisecond = bytesPerSecond / 1000;
            const data = new Uint8Array(audioBuffer);
            let offset = 0;
            let updateCount = 0;

            console.log(`Starting stream: ${data.length} bytes (${(data.length / 2)} Int16 samples)`);
            setFileStatus('<p>Streaming...</p>');

            const streamChunk = () => {
                if(offset < data.length && isSocketOpen(audioState.socket) && audioState.isStreaming) {
                    const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
                    audioState.socket.send(chunk);
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
                    audioState.isStreaming = false;
                    
                    // Keep socket open a bit longer to ensure all data is played
                    setTimeout(() => {
                        if(isSocketOpen(audioState.socket)) {
                            closeAudioSocket(audioState.socket);
                        }
                        resolve();
                    }, 500);
                }
            };

            audioState.isStreaming = true;
            streamChunk();
        };

        audioState.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            audioState.isStreaming = false;
            reject(error);
        };

        audioState.socket.onclose = () => {
            console.log("WebSocket closed after streaming");
            audioState.isStreaming = false;
        };
    });
}



window.switchToMicrophone = switchToMicrophone;
window.stopMicrophone = stopMicrophone;
window.switchToFile = switchToFile;
window.onFileSelected = onFileSelected;
window.streamSelectedFile = streamSelectedFile;
window.stopAudio = stopAudio;
