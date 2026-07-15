import
{
    getAudioFile
} from "./folder_manager.js";

import
{
    streamAudioFile
} from "./audio_file_controller.js";

export async function streamShowAudio(show)
{
    try
    {
        const file = await getAudioFile(show.file);
        await streamAudioFile(file);
    }
    catch(err)
    {
        console.error('Failed to stream show audio:', err);
        alert(`Error: Could not load audio file "${show.file}". Make sure it exists in the selected folder.`);
    }
}
