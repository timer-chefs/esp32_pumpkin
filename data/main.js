import
{
    switchToMicrophone,
    stopMicrophone
} from "./microphone_controller.js";

import
{
    switchToFile,
    onFileSelected,
    streamSelectedFile,
} from "./audio_file_controller.js";

import {
    stopAudio
} from "./audio_cleanup.js";

document
    .getElementById("btn-microphone")
    .addEventListener("click", switchToMicrophone);
document
    .getElementById("btn-stop-microphone")
    .addEventListener("click", stopMicrophone);
document
    .getElementById("btn-file")
    .addEventListener("click", switchToFile);
document
    .getElementById("audio-file")
    .addEventListener("change", onFileSelected);
document
    .getElementById("btn-stream")
    .addEventListener("click", streamSelectedFile);
document
    .getElementById("btn-stop-file")
    .addEventListener("click", stopAudio);
