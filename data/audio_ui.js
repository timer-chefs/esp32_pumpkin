export function showMicrophoneMode()
{
    document.getElementById('microphone-section').style.display = 'block';
    document.getElementById('file-section').style.display = 'none';
    document.getElementById('btn-microphone').disabled = true;
    document.getElementById('btn-file').disabled = false;
}

export function hideMicrophoneMode()
{
    document.getElementById('microphone-section').style.display = 'none';
    document.getElementById('btn-microphone').disabled = false;    
}

export function showFileMode()
{
    document.getElementById('file-section').style.display = 'block';
    document.getElementById('microphone-section').style.display = 'none';
    document.getElementById('btn-file').disabled = true;
    document.getElementById('btn-microphone').disabled = false;
}

export function setFileStatus(html)
{
    document.getElementById('file-status').innerHTML = html;
}

export function clearFileStatus()
{
    document.getElementById('file-status').innerHTML = '';
}

export function setStreamFileEnabled(enabled)
{
    document.getElementById('btn-stream').disabled = !enabled;
}
