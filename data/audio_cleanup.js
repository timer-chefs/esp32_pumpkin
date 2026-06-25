import
{
    audioState
} from "./audio_state.js";

import
{
    isSocketOpen,
    closeAudioSocket
} from './audio_socket.js';

import
{
    clearFileStatus,
    setCurrentMode,
    setCurrentStreamingEnabled
} from './audio_ui.js';

export function stopAudio() {
    audioState.isStreaming = false;
    
    if(audioState.currentStream) {
        audioState.currentStream.getTracks().forEach(track => track.stop());
        audioState.currentStream = null;
    }

    if(audioState.currentProcessorNode) {
        audioState.currentProcessorNode.port.onmessage = null;
        audioState.currentProcessorNode.disconnect();
        audioState.currentProcessorNode = null;
    }

    if(audioState.currentAudioContext) {
        audioState.currentAudioContext.close().catch(() => {});
        audioState.currentAudioContext = null;
    }
    
    if(audioState.socket && isSocketOpen(audioState.socket))
    {
        audioState.socket.send("STOP");

        setTimeout(() => {
            closeAudioSocket(audioState.socket);
        }, 100);
    }
    audioState.socket = null;
    
    clearFileStatus();

    setCurrentMode("Idle");
    setCurrentStreamingEnabled(false);
    
    // Also try to reset buffer when stopping
    try {
        fetch('/api/audio/reset').catch(() => {});
    } catch(err) {
        // Ignore errors
    }
}
