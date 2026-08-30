import { FolderOpen, Ghost } from "lucide-react";
import { Alert, Button } from "react-bootstrap";

import { useAppContext } from "../app_context.tsx";

export function PresetShowControl() {
  const { state, actions } = useAppContext();

  return (
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
          variant={state.folderStatus === "success" ? "success" : "danger"}
          className="compact-alert"
          aria-live="polite"
        >
          {state.folderStatus === "success"
            ? "Audio folder ready"
            : "Audio folder unavailable"}
        </Alert>
      )}
    </section>
  );
}
