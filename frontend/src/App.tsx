import { useEffect, useSyncExternalStore } from "react";
import {
  FileAudio,
  FolderOpen,
  Ghost,
  Mic,
  Minus,
  Plus,
  Square,
  Volume2,
} from "lucide-react";

import { stopAudio } from "./audio_cleanup.ts";
import {
  onFileSelected,
  streamSelectedFile,
  switchToFile,
} from "./audio_file_controller.ts";
import { getAudioUiState, subscribeToAudioUi } from "./audio_ui.ts";
import {
  decreaseVolume,
  increaseVolume,
  loadVolume,
} from "./audio_volume_control.ts";
import { handleSelectAudioFolder } from "./folder_manager.ts";
import { stopMicrophone, switchToMicrophone } from "./microphone_controller.ts";
import { presetShows } from "./preset_shows.ts";
import type { PresetShow } from "./preset_shows.ts";
import { playShow } from "./show_controller.ts";

const ghostShow = getPresetShow("Ghost");

export function App() {
  const ui = useSyncExternalStore(
    subscribeToAudioUi,
    getAudioUiState,
    getAudioUiState,
  );

  useEffect(() => {
    runAction(loadVolume);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">ESP32 audio controller</p>
          <h1>Pumpkin Audio</h1>
        </div>
        <div className="live-status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <span className="status-label">Current mode</span>
            <strong>{ui.currentMode}</strong>
          </div>
          {ui.currentStreaming && (
            <div>
              <span className="status-label">Streaming</span>
              <strong>{ui.currentStreaming}</strong>
            </div>
          )}
        </div>
      </header>

      <section className="control-band" aria-labelledby="source-heading">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="source-heading">Choose a source</h2>
          </div>
          <p>Send live microphone input or a local audio file.</p>
        </div>

        <div className="source-controls">
          <button
            className="source-button"
            disabled={ui.activePanel === "microphone"}
            onClick={() => runAction(switchToMicrophone)}
          >
            <Mic aria-hidden="true" />
            <span>
              <strong>Microphone</strong>
              <small>Stream live audio</small>
            </span>
          </button>
          <button
            className="source-button"
            disabled={ui.activePanel === "file"}
            onClick={() => runAction(switchToFile)}
          >
            <FileAudio aria-hidden="true" />
            <span>
              <strong>Audio file</strong>
              <small>Play a local recording</small>
            </span>
          </button>
        </div>

        <div className="source-workspace">
          <div className="empty-state" hidden={ui.activePanel !== null}>
            Select an audio source to begin.
          </div>

          <div className="active-source" hidden={ui.activePanel !== "microphone"}>
            <div>
              <span className="pulse" aria-hidden="true" />
              <strong>Streaming microphone audio</strong>
            </div>
            <button className="stop-button" onClick={() => runAction(stopMicrophone)}>
              <Square aria-hidden="true" />
              Stop
            </button>
          </div>

          <div className="file-source" hidden={ui.activePanel !== "file"}>
            <label className="file-picker">
              <FileAudio aria-hidden="true" />
              <span>
                <strong>Select an audio file</strong>
                <small>Choose any browser-supported audio format</small>
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={(event) =>
                  onFileSelected(event.currentTarget.files?.[0] ?? null)
                }
              />
            </label>
            {ui.fileStatus && (
              <p className={`file-status ${ui.fileStatus.tone}`} aria-live="polite">
                {ui.fileStatus.message}
              </p>
            )}
            <div className="file-actions">
              <button
                disabled={!ui.streamFileEnabled}
                onClick={() => runAction(streamSelectedFile)}
              >
                <Volume2 aria-hidden="true" />
                Stream file
              </button>
              <button className="stop-button" onClick={() => runAction(stopAudio)}>
                <Square aria-hidden="true" />
                Stop
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="secondary-controls">
        <div className="control-section" aria-labelledby="volume-heading">
          <div className="section-heading compact">
            <div>
              <p className="section-number">02</p>
              <h2 id="volume-heading">Output volume</h2>
            </div>
          </div>
          <div className="volume-control">
            <button
              className="icon-button"
              aria-label="Decrease volume"
              title="Decrease volume"
              onClick={() => runAction(decreaseVolume)}
            >
              <Minus aria-hidden="true" />
            </button>
            <div className="volume-value">
              <span>{Math.round(ui.volume * 100)}</span>
              <small>percent</small>
            </div>
            <button
              className="icon-button"
              aria-label="Increase volume"
              title="Increase volume"
              onClick={() => runAction(increaseVolume)}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="control-section" aria-labelledby="shows-heading">
          <div className="section-heading compact">
            <div>
              <p className="section-number">03</p>
              <h2 id="shows-heading">Preset show</h2>
            </div>
          </div>
          <button
            className="folder-button"
            onClick={() => runAction(handleSelectAudioFolder)}
          >
            <FolderOpen aria-hidden="true" />
            Select audio folder
          </button>
          {ui.folderStatus && (
            <p className={`folder-status ${ui.folderStatus}`} role="status">
              {ui.folderStatus === "success"
                ? "Audio folder selected"
                : "Failed to select folder"}
            </p>
          )}
          <button className="show-button" onClick={() => runAction(() => playShow(ghostShow))}>
            <Ghost aria-hidden="true" />
            <span>
              <strong>Ghost</strong>
              <small>Run preset show</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

function runAction(action: () => void | Promise<void>): void {
  try {
    Promise.resolve(action()).catch(reportActionError);
  } catch (error) {
    reportActionError(error);
  }
}

function reportActionError(error: unknown): void {
  console.error("Action failed:", error);
}

function getPresetShow(name: string): PresetShow {
  const show = presetShows.find((preset) => preset.name === name);
  if (!show) {
    throw new Error(`Expected a preset show named "${name}"`);
  }

  return show;
}