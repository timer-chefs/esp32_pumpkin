import
{
    switchToMicrophone,
    stopMicrophone
} from "./mic_controller.js";

import
{
    switchToFile,
    onFileSelected,
    streamSelectedFile,
} from "./file_controller.js";

import {
    stopAudio
} from "./audio_cleanup.js";



window.switchToMicrophone = switchToMicrophone;
window.stopMicrophone = stopMicrophone;
window.switchToFile = switchToFile;
window.onFileSelected = onFileSelected;
window.streamSelectedFile = streamSelectedFile;
window.stopAudio = stopAudio;
