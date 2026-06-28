import
{
    createAudioSocket
} from "./audio_socket.js";

export function playShow(showId)
{
    const socket = createAudioSocket(location.hostname);

    socket.onopen = onOpen;
   
    function onOpen()
    {
        socket.send(JSON.stringify(
            {
                command: "PLAY_SHOW",
                show: showId
            }
        ));

        setTimeout(() => socket.close(), 100);
    }
}
