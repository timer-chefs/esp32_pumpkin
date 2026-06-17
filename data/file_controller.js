import
{
    audioState
} from "./audio_state.js";

import {
    stopAudio
} from "./audio_cleanup.js";

import
{
    showFileMode,
    setFileStatus,
    clearFileStatus,
    setStreamFileEnabled
} from "./audio_ui.js";

import
{
    createAudioSocket,
    isSocketOpen,
    closeAudioSocket
} from "./audio_socket.js";

import
{
    processAudioFile
} from "./audio_file_processor.js";

export function switchToFile() {
    stopAudio();
    showFileMode();
}

export function onFileSelected(event) {
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

export async function streamSelectedFile() {
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

    const int16Data = await processAudioFile(audioState.selectedFile);

    await streamAudioData(int16Data.buffer);
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
