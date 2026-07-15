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

import
{
    stopAudio
} from "./audio_cleanup.js";

import
{
    increase_volume,
    decrease_volume,
    load_volume
} from "./audio_volume_control.js";

import
{
    playShow
} from "./show_controller.js";

import
{
    presetShows
} from "./preset_shows.js";

import
{
    handleSelectAudioFolder
} from "./folder_manager.js";

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
document
    .getElementById("btn-volume-up")
    .addEventListener("click", increase_volume);
document
    .getElementById("btn-volume-down")
    .addEventListener("click", decrease_volume);
document
    .getElementById("btn-show-ghost")
    .addEventListener("click", playShow.bind(null, presetShows[1]));    
document
    .getElementById("btn-select-audio-folder")
    .addEventListener("click", handleSelectAudioFolder);

load_volume();
