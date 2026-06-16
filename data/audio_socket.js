export function createAudioSocket(hostname, handlers = {})
{
    const socket = new WebSocket(`ws://${hostname}:81/`);
    socket.binaryType = "arraybuffer";

    if(handlers.onOpen)
    {
        socket.onopen = handlers.onOpen;
    }
    if(handlers.onClose)
    {
        socket.onclose = handlers.onClose;
    }
    if(handlers.onError)
    {
        socket.onerror = handlers.onError;
    }

    return socket;
}

export function isSocketOpen(socket)
{
    return socket && socket.readyState === WebSocket.OPEN;
}

export function closeAudioSocket(socket)
{
    if(isSocketOpen(socket))
    {
        socket.close();
    }
}
