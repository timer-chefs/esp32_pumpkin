import { useAppContext } from "../../app/app_context.tsx";
import { runAction, type Slice } from "../../app/slice.ts";
import api from "../../pumpkin_client.ts";

interface ReadableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker(): Promise<ReadableDirectoryHandle>;
}

const GHOST_SHOW = { id: 1, audioFile: "ghost.wav" };

export interface PresetShowsState {
  folderStatus: "success" | "error" | null;
}

export interface PresetShowsActions {
  playGhostShow: () => void;
  selectAudioFolder: () => void;
}

export const presetShowsSlice: Slice<PresetShowsState, PresetShowsActions> = {
  initialState: { folderStatus: null },
  createActions: ({ update, app }) => {
    let selectedFolder: ReadableDirectoryHandle | null = null;

    const getAudioFile = async (fileName: string): Promise<File> => {
      if (!selectedFolder) {
        throw new Error("No audio folder selected");
      }

      const fileHandle = await selectedFolder.getFileHandle(fileName);
      return fileHandle.getFile();
    };

    return {
      playGhostShow: () =>
        runAction(async () => {
          api.playShow(await app.connection(), GHOST_SHOW.id);

          try {
            const file = await getAudioFile(GHOST_SHOW.audioFile);
            await app.actions().audioSource.streamFile(file);
          } catch (error) {
            console.error("Failed to stream show audio:", error);
            alert(
              `Could not load "${GHOST_SHOW.audioFile}". Make sure it exists in the selected folder.`,
            );
          }
        }),

      selectAudioFolder: () =>
        runAction(async () => {
          try {
            const folder = await (
              window as unknown as DirectoryPickerWindow
            ).showDirectoryPicker();
            if (
              (await folder.queryPermission({ mode: "read" })) !== "granted"
            ) {
              const permission = await folder.requestPermission({
                mode: "read",
              });
              if (permission !== "granted") {
                throw new Error("Permission denied");
              }
            }

            selectedFolder = folder;
            update({ folderStatus: "success" });
          } catch (error) {
            console.error("Folder selection failed:", error);
            update({ folderStatus: "error" });
          }
        }),
    };
  },
};

export interface PresetShowControls {
  folderStatus: PresetShowsState["folderStatus"];
  playGhostShow: PresetShowsActions["playGhostShow"];
  selectAudioFolder: PresetShowsActions["selectAudioFolder"];
}

export function usePresetShows(): PresetShowControls {
  const { state, actions } = useAppContext();
  return {
    folderStatus: state.presetShows.folderStatus,
    playGhostShow: actions.presetShows.playGhostShow,
    selectAudioFolder: actions.presetShows.selectAudioFolder,
  };
}
