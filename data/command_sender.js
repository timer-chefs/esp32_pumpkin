export function sendCommand(socket, command)
{
    socket.send(JSON.stringify(command));
}
