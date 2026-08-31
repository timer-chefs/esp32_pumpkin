import { FolderOpen, Ghost } from "lucide-react";
import { Alert, Button } from "react-bootstrap";

import { usePresetShows } from "../app_context.tsx";

export function PresetShowControl() {
  const { folderStatus, playGhostShow, selectAudioFolder } = usePresetShows();

  return (
    <section className="utility-section" aria-labelledby="shows-heading">
      <div className="section-heading">
        <h2 id="shows-heading">Preset show</h2>
      </div>
      <div className="preset-actions">
        <Button
          variant="outline-dark"
          className="icon-label-button"
          onClick={selectAudioFolder}
        >
          <FolderOpen aria-hidden="true" />
          Audio folder
        </Button>
        <Button
          variant="success"
          className="icon-label-button"
          onClick={playGhostShow}
        >
          <Ghost aria-hidden="true" />
          Ghost
        </Button>
      </div>
      {folderStatus && (
        <Alert
          variant={folderStatus === "success" ? "success" : "danger"}
          className="compact-alert"
          aria-live="polite"
        >
          {folderStatus === "success"
            ? "Audio folder ready"
            : "Audio folder unavailable"}
        </Alert>
      )}
    </section>
  );
}
