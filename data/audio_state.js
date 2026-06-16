export const audioState = {
    socket: null,
    currentStream: null,
    selectedFile: null,
    isStreaming: false,
    currentAudioContext: null,
    currentProcessorNode: null,
};

export function resetAudioState() {
    audioState.socket = null;
    audioState.currentStream = null;
    audioState.selectedFile = null;
    audioState.isStreaming = false;
    audioState.currentAudioContext = null;
    audioState.currentProcessorNode = null;
}
