import { FileAudio, Mic, Square, Volume2 } from "lucide-react";
import { Alert, Button, Form, Stack } from "react-bootstrap";

import { useAppContext } from "../app_context.tsx";

export function AudioSourceControl() {
  const { state, actions } = useAppContext();
  const { activeSource, fileStatus, streamFileEnabled } = state;

  return (
    <section className="control-section" aria-labelledby="source-heading">
      <div className="section-heading">
        <h2 id="source-heading">Audio source</h2>
        <span className="text-body-secondary">Select one input</span>
      </div>

      <div className="source-selector" role="group" aria-label="Audio source">
        <Button
          variant={activeSource === "microphone" ? "dark" : "outline-dark"}
          className="source-button"
          disabled={activeSource === "microphone"}
          onClick={actions.startMicrophone}
        >
          <Mic aria-hidden="true" />
          Microphone
        </Button>
        <Button
          variant={activeSource === "file" ? "dark" : "outline-dark"}
          className="source-button"
          disabled={activeSource === "file"}
          onClick={actions.startFileMode}
        >
          <FileAudio aria-hidden="true" />
          Audio file
        </Button>
      </div>

      <div className="source-workspace">
        {activeSource === null && (
          <p className="empty-state mb-0">No source active</p>
        )}

        {activeSource === "microphone" && (
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

        {activeSource === "file" && (
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
            {fileStatus && (
              <Alert
                variant={fileStatus.tone === "success" ? "success" : "light"}
                className="compact-alert"
                aria-live="polite"
              >
                {fileStatus.message}
              </Alert>
            )}
            <Stack direction="horizontal" gap={2} className="mt-3">
              <Button
                variant="warning"
                className="icon-label-button"
                disabled={!streamFileEnabled}
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
  );
}
