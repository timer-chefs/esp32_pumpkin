import { FileAudio, Mic, Music, Square, Volume2 } from "lucide-react";
import { Alert, Button, Form, Spinner, Stack } from "react-bootstrap";

import { SdCardFileList } from "../sd_card/SdCardFileList.tsx";
import { useAudioSource } from "./audio_source_slice.ts";

export function AudioSourceControl() {
  const {
    active,
    fileStatus,
    microphoneStatus,
    streamFileEnabled,
    selectFile,
    startFile,
    startFileMode,
    startMicrophone,
    startSdCardMode,
    stopAudio,
    stopMicrophone,
  } = useAudioSource();

  return (
    <section className="control-section" aria-labelledby="source-heading">
      <div className="section-heading">
        <h2 id="source-heading">Audio source</h2>
        <span className="text-body-secondary">Select one input</span>
      </div>

      <div className="source-selector" role="group" aria-label="Audio source">
        <Button
          variant={active === "microphone" ? "dark" : "outline-dark"}
          className="source-button"
          disabled={active === "microphone"}
          onClick={startMicrophone}
        >
          <Mic aria-hidden="true" />
          Microphone
        </Button>
        <Button
          variant={active === "file" ? "dark" : "outline-dark"}
          className="source-button"
          disabled={active === "file"}
          onClick={startFileMode}
        >
          <FileAudio aria-hidden="true" />
          Audio file
        </Button>
        <Button
          variant={active === "sdCard" ? "dark" : "outline-dark"}
          className="source-button"
          disabled={active === "sdCard"}
          onClick={startSdCardMode}
        >
          <Music aria-hidden="true" />
          SD card
        </Button>
      </div>

      <div className="source-workspace">
        {active === null && (
          <p className="empty-state mb-0">No source active</p>
        )}

        {active === "microphone" && (
          <div className="active-source-row" aria-live="polite">
            <Stack direction="horizontal" gap={3}>
              {microphoneStatus === "starting" ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <span className="status-dot" aria-hidden="true" />
              )}
              <strong>
                {microphoneStatus === "starting"
                  ? "Starting microphone"
                  : "Microphone streaming"}
              </strong>
            </Stack>
            <Button
              variant="outline-danger"
              className="icon-label-button"
              onClick={stopMicrophone}
            >
              <Square aria-hidden="true" />
              Stop
            </Button>
          </div>
        )}

        {active === "file" && (
          <div className="file-source">
            <Form.Group controlId="audio-file">
              <Form.Label className="fw-semibold">Audio file</Form.Label>
              <Form.Control
                type="file"
                accept="audio/*"
                onChange={(event) =>
                  selectFile(
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
                onClick={startFile}
              >
                <Volume2 aria-hidden="true" />
                Stream
              </Button>
              <Button
                variant="outline-danger"
                className="icon-label-button"
                onClick={stopAudio}
              >
                <Square aria-hidden="true" />
                Stop
              </Button>
            </Stack>
          </div>
        )}

        {active === "sdCard" && <SdCardFileList />}
      </div>
    </section>
  );
}
