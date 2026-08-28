import { setFolderStatus } from "./audio_ui.ts";

interface ReadableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(): Promise<ReadableDirectoryHandle>;
}

let selectedFolder: ReadableDirectoryHandle | null = null;

export async function selectAudioFolder(): Promise<boolean> {
  try {
    const folder = await (
      window as unknown as DirectoryPickerWindow
    ).showDirectoryPicker();
    if ((await folder.queryPermission({ mode: "read" })) !== "granted") {
      const permission = await folder.requestPermission({ mode: "read" });
      if (permission !== "granted") {
        throw new Error("Permission denied");
      }
    }

    selectedFolder = folder;
    console.log("Audio folder selected successfully");
    return true;
  } catch (error) {
    console.error("Folder selection failed:", error);
    return false;
  }
}

export async function getAudioFile(fileName: string): Promise<File> {
  if (!selectedFolder) {
    throw new Error(
      'No audio folder selected. Please click "Select Audio Folder" first.',
    );
  }

  try {
    const fileHandle = await selectedFolder.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    console.log(`Got file: ${fileName}`);
    return file;
  } catch (error) {
    console.error(`Could not get file ${fileName}:`, error);
    throw new Error(`Audio file not found: ${fileName}`, { cause: error });
  }
}

export function isFolderSelected(): boolean {
  return selectedFolder !== null;
}

export async function handleSelectAudioFolder(): Promise<void> {
  setFolderStatus(await selectAudioFolder());
}
