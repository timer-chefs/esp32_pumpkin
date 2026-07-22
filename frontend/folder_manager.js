const FOLDER_HANDLE_KEY = 'audioFolderHandle';
let cachedFolderHandle = null;  // Store the handle in memory for the session

// Request user to pick the audio folder
export async function selectAudioFolder()
{
    try {
        const folderHandle = await window.showDirectoryPicker();
        
        // Verify permission to read
        if (await folderHandle.queryPermission({ mode: 'read' }) !== 'granted') {
            if (await folderHandle.requestPermission({ mode: 'read' }) !== 'granted') {
                throw new Error('Permission denied');
            }
        }
        
        // Cache the handle in memory
        cachedFolderHandle = folderHandle;
        localStorage.setItem(FOLDER_HANDLE_KEY, 'folder-selected');
        
        console.log('Audio folder selected successfully');
        return true;
    } catch (err) {
        console.error('Folder selection failed:', err);
        return false;
    }
}

// Get a file from the audio folder
export async function getAudioFile(fileName)
{
    try {
        if (!cachedFolderHandle) {
            throw new Error('No audio folder selected. Please click "Select Audio Folder" first.');
        }
        
        const fileHandle = await cachedFolderHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        
        console.log(`Got file: ${fileName}`);
        return file;
    } catch (err) {
        console.error(`Could not get file ${fileName}:`, err);
        throw new Error(`Audio file not found: ${fileName}`);
    }
}

export function isFolderSelected()
{
    return cachedFolderHandle !== null;
}

export async function handleSelectAudioFolder()
{
    const success = await selectAudioFolder();
    const statusDiv = document.getElementById("folder-status");
    
    if(success)
    {
        statusDiv.innerHTML = '<p style="color: green;">✓ Audio folder selected</p>';
    }
    else
    {
        statusDiv.innerHTML = '<p style="color: red;">✗ Failed to select folder</p>';
    }
}
