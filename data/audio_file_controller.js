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
    processAudioFile
} from "./audio_file_processor.js";

import {
    streamAudioData
} from "./audio_streamer.js";

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

    try
    {
        const int16Data = await processAudioFile(audioState.selectedFile);
        await streamAudioData(int16Data.buffer);
    }
    catch(err)
    {
        alert("Failed to process audio file. Make sure it's a valid audio file.");
    }
}
