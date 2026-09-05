import { Upload, X } from "lucide-react";
import { Button, Form, ProgressBar, Stack } from "react-bootstrap";
import { useRef, useState } from "react";

import { useSdCard } from "../app_context.tsx";
import type { UploadState } from "../app_controller.ts";

export function SdCardUpload() {
  const { upload, cancelUpload, uploadFile } = useSdCard();
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (upload) {
    return <UploadProgress upload={upload} onCancel={cancelUpload} />;
  }

  const startUpload = () => {
    if (file) {
      uploadFile(file);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <Stack direction="horizontal" gap={2} className="sd-card-upload">
      <Form.Group controlId="sd-card-upload" className="flex-grow-1">
        <Form.Label visuallyHidden>Song to upload</Form.Label>
        <Form.Control
          ref={inputRef}
          type="file"
          size="sm"
          accept="audio/*"
          onChange={(event) =>
            setFile(
              (event.currentTarget as HTMLInputElement).files?.[0] ?? null,
            )
          }
        />
      </Form.Group>
      <Button
        variant="warning"
        size="sm"
        className="icon-label-button"
        disabled={file === null}
        onClick={startUpload}
      >
        <Upload aria-hidden="true" />
        Upload
      </Button>
    </Stack>
  );
}

interface UploadProgressProps {
  upload: UploadState;
  onCancel: () => void;
}

function UploadProgress({ upload, onCancel }: UploadProgressProps) {
  const percentage =
    upload.totalBytes === 0
      ? 0
      : Math.round((upload.bytesSent / upload.totalBytes) * 100);

  return (
    <div className="sd-card-upload" aria-live="polite">
      <Stack direction="horizontal" gap={2}>
        <span className="sd-card-file-name">{upload.name}</span>
        <span className="text-body-secondary ms-auto">
          {describe(upload, percentage)}
        </span>
        <Button
          variant="outline-danger"
          size="sm"
          className="icon-label-button"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
          Cancel
        </Button>
      </Stack>
      <ProgressBar
        now={percentage}
        animated={upload.phase === "converting"}
        label={`${percentage}%`}
        aria-label="Upload progress"
      />
    </div>
  );
}

function describe(upload: UploadState, percentage: number): string {
  if (upload.phase === "converting") {
    return "Converting...";
  }

  const parts = [`${percentage}%`];

  if (upload.bytesPerSecond !== null) {
    parts.push(`${(upload.bytesPerSecond / 1024).toFixed(0)} kB/s`);
  }

  if (upload.secondsRemaining !== null) {
    parts.push(`${formatDuration(upload.secondsRemaining)} left`);
  }

  return parts.join(" - ");
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.ceil(seconds % 60)}s`;
}
