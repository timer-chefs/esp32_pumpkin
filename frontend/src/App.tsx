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
import {
  Alert,
  Button,
  ButtonGroup,
  Container,
  Form,
  Stack,
} from "react-bootstrap";

import { useAppController } from "./app_controller.ts";

export function App() {
  const { state, actions } = useAppController();

  return (
    <main className="app-shell min-vh-100">
      <Container className="app-container py-4 py-lg-5">
        <header className="app-header">
          <div>
            <p className="app-kicker mb-1">ESP32 controller</p>
            <h1 className="mb-0">Pumpkin</h1>
          </div>
          <div className="app-status" aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            <span>
              <small>Mode</small>
              <strong>{state.currentMode}</strong>
            </span>
            {state.currentStreaming && (
              <span className="streaming-label text-truncate">
                {state.currentStreaming}
              </span>
            )}
          </div>
        </header>

        <section className="control-section" aria-labelledby="source-heading">
          <div className="section-heading">
            <h2 id="source-heading">Audio source</h2>
            <span className="text-body-secondary">Select one input</span>
          </div>

          <div
            className="source-selector"
            role="group"
            aria-label="Audio source"
          >
            <Button
              variant={
                state.activeSource === "microphone" ? "dark" : "outline-dark"
              }
              className="source-button"
              disabled={state.activeSource === "microphone"}
              onClick={actions.startMicrophone}
            >
              <Mic aria-hidden="true" />
              Microphone
            </Button>
            <Button
              variant={state.activeSource === "file" ? "dark" : "outline-dark"}
              className="source-button"
              disabled={state.activeSource === "file"}
              onClick={actions.startFileMode}
            >
              <FileAudio aria-hidden="true" />
              Audio file
            </Button>
          </div>

          <div className="source-workspace">
            {state.activeSource === null && (
              <p className="empty-state mb-0">No source active</p>
            )}

            {state.activeSource === "microphone" && (
              <div className="active-source-row">
                <Stack direction="horizontal" gap={3}>
                  <span className="status-dot" aria-hidden="true" />
                  <strong>Microphone streaming</strong>
                </Stack>
                <Button
                  variant="outline-danger"
                  className="icon-label-button"
                  onClick={actions.stopMicrophone}
                >
                  <Square aria-hidden="true" />
                  Stop
                </Button>
              </div>
            )}

            {state.activeSource === "file" && (
              <div className="file-source">
                <Form.Group controlId="audio-file">
                  <Form.Label className="fw-semibold">Audio file</Form.Label>
                  <Form.Control
                    type="file"
                    accept="audio/*"
                    onChange={(event) =>
                      actions.selectAudioFile(
                        (event.currentTarget as HTMLInputElement).files?.[0] ??
                          null,
                      )
                    }
                  />
                </Form.Group>
                {state.fileStatus && (
                  <Alert
                    variant={
                      state.fileStatus.tone === "success" ? "success" : "light"
                    }
                    className="compact-alert"
                    aria-live="polite"
                  >
                    {state.fileStatus.message}
                  </Alert>
                )}
                <Stack direction="horizontal" gap={2} className="mt-3">
                  <Button
                    variant="warning"
                    className="icon-label-button"
                    disabled={!state.streamFileEnabled}
                    onClick={actions.startFile}
                  >
                    <Volume2 aria-hidden="true" />
                    Stream
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="icon-label-button"
                    onClick={actions.stopAudio}
                  >
                    <Square aria-hidden="true" />
                    Stop
                  </Button>
                </Stack>
              </div>
            )}
          </div>
        </section>

        <div className="utility-grid">
          <section className="utility-section" aria-labelledby="volume-heading">
            <div className="section-heading">
              <h2 id="volume-heading">Volume</h2>
            </div>
            <ButtonGroup aria-label="Output volume controls">
              <Button
                variant="outline-dark"
                className="icon-button"
                aria-label="Decrease volume"
                title="Decrease volume"
                onClick={actions.decreaseVolume}
              >
                <Minus aria-hidden="true" />
              </Button>
              <output className="volume-readout">
                <strong>{Math.round(state.volume * 100)}</strong>
                <small>%</small>
              </output>
              <Button
                variant="outline-dark"
                className="icon-button"
                aria-label="Increase volume"
                title="Increase volume"
                onClick={actions.increaseVolume}
              >
                <Plus aria-hidden="true" />
              </Button>
            </ButtonGroup>
          </section>

          <section className="utility-section" aria-labelledby="shows-heading">
            <div className="section-heading">
              <h2 id="shows-heading">Preset show</h2>
            </div>
            <div className="preset-actions">
              <Button
                variant="outline-dark"
                className="icon-label-button"
                onClick={actions.selectAudioFolder}
              >
                <FolderOpen aria-hidden="true" />
                Audio folder
              </Button>
              <Button
                variant="success"
                className="icon-label-button"
                onClick={actions.playGhostShow}
              >
                <Ghost aria-hidden="true" />
                Ghost
              </Button>
            </div>
            {state.folderStatus && (
              <Alert
                variant={
                  state.folderStatus === "success" ? "success" : "danger"
                }
                className="compact-alert"
                aria-live="polite"
              >
                {state.folderStatus === "success"
                  ? "Audio folder ready"
                  : "Audio folder unavailable"}
              </Alert>
            )}
          </section>
        </div>
      </Container>
    </main>
  );
}
