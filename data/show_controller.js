import
{
    createAudioSocket
} from "./audio_socket.js";

import
{
    streamShowAudio
} from "./show_audio.js";

export async function playShow(show)
{
    await sendPlayShow(show);
    await streamShowAudio(show);
}

async function sendPlayShow(show)
{
    return new Promise((resolve) =>
    {
        const socket = createAudioSocket(location.hostname);

        socket.onopen = onOpen;
        socket.onclose = onClose;
        socket.onerror = onError;

        function onOpen()
        {
            socket.send(JSON.stringify(
                {
                    command: "PLAY_SHOW",
                    show: show.id
                }
            ));

            setTimeout(() => socket.close(), 100);
        }

        function onClose()
        {
            // cleanup handlers
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            resolve();
        }

        function onError()
        {
            // treat errors as completion to avoid hanging
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            resolve();
        }
    });
}
