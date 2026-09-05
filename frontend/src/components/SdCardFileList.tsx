import { Play, RefreshCw, Square } from "lucide-react";
import { Alert, Button, ListGroup, Spinner, Stack } from "react-bootstrap";

import { useSdCard } from "../app_context.tsx";
import { SdCardUpload } from "./SdCardUpload.tsx";

export function SdCardFileList() {
  const { error, files, isLoading, playingFile, playFile, refresh, stop } =
    useSdCard();

  return (
    <div className="sd-card-source">
      <Stack direction="horizontal" gap={2} className="sd-card-toolbar">
        <span className="fw-semibold">Files on the SD card</span>
        <Button
          variant="outline-dark"
          size="sm"
          className="icon-label-button ms-auto"
          disabled={isLoading}
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
        <Button
          variant="outline-danger"
          size="sm"
          className="icon-label-button"
          disabled={playingFile === null}
          onClick={stop}
        >
          <Square aria-hidden="true" />
          Stop
        </Button>
      </Stack>

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}

      {isLoading && files === null && (
        <p className="empty-state mb-0">
          <Spinner animation="border" size="sm" aria-label="Reading SD card" />
        </p>
      )}

      {files !== null && files.length === 0 && (
        <p className="empty-state mb-0">No audio files on the SD card</p>
      )}

      <SdCardUpload />

      {files !== null && files.length > 0 && (
        <ListGroup className="sd-card-files">
          {files.map((file) => (
            <ListGroup.Item key={file.name} className="sd-card-file">
              <span className="sd-card-file-name">{file.name}</span>
              <span className="text-body-secondary">
                {formatSize(file.size)}
              </span>
              {file.name === playingFile && (
                <span className="status-dot" aria-label="Playing" />
              )}
              <Button
                variant="warning"
                size="sm"
                className="icon-label-button"
                onClick={() => playFile(file.name)}
              >
                <Play aria-hidden="true" />
                Play
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
