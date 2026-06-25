import
{
    createAudioSocket,
    isSocketOpen,
    closeAudioSocket
} from './audio_socket.js';

import
{
    showMicrophoneMode,
    hideMicrophoneMode,
    setCurrentMode,
    setCurrentStreaming
} from './audio_ui.js';

import
{
    audioState
} from "./audio_state.js";

import { stopAudio } from './audio_cleanup.js';

export async function switchToMicrophone() {
    stopAudio();
    showMicrophoneMode();
    
    try {
        audioState.socket = createAudioSocket(location.hostname);
        let audioContext = null;
        let processorNode = null;

        audioState.socket.onopen = async () => {
            audioState.socket.send("PLAY");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                .catch(err => { 
                    console.error(err); 
                    alert("Microphone access failed."); 
                    closeAudioSocket(audioState.socket); 
                    throw err; 
                });

            audioState.currentStream = stream;

            audioContext = new AudioContext({
                sampleRate: 16000
            });
            audioState.currentAudioContext = audioContext;

            await audioContext.audioWorklet.addModule('/worklet_processor.js');

            const source = audioContext.createMediaStreamSource(stream);
            console.log(`Microphone AudioContext sample rate: ${audioContext.sampleRate}Hz`);
            processorNode = new AudioWorkletNode(audioContext, 'pcm-processor');
            audioState.currentProcessorNode = processorNode;

            processorNode.port.onmessage = (event) => {
                if(isSocketOpen(audioState.socket)) {
                    audioState.socket.send(event.data);
                }
            };

            source.connect(processorNode);
            audioState.isStreaming = true;
            console.log("Streaming microphone...");
            
            setCurrentMode("Microphone");
            setCurrentStreaming("Microphone");
        };

        audioState.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        audioState.socket.onclose = () => {
            console.log("WebSocket closed");
            if(processorNode) {
                processorNode.port.onmessage = null;
            }
            audioState.isStreaming = false;
        };
    } catch (err) {
        console.error("Error:", err);
        document.getElementById('btn-microphone').disabled = false;
    }
}

export function stopMicrophone() {
    stopAudio();
    hideMicrophoneMode();
}
