import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { Alert, Button, ListGroup, Modal, Spinner } from "react-bootstrap";

import "./presets.css";
import { presetIcons, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";
import { useIsSoundMissing } from "./use_is_sound_missing.ts";

/**
 * Where the presets are put in order and taken away. Nothing reaches the
 * card until Done, so Cancel takes back all of it.
 */
export function PresetEditor() {
  const { draft, isSaving, error, move, remove, finishEditing, cancelEditing } =
    usePresets();
  const isSoundMissing = useIsSoundMissing();

  return (
    <Modal
      show={draft !== null}
      onHide={cancelEditing}
      // Leaving is Cancel or Done, never a stray Escape that loses the edits.
      backdrop="static"
      keyboard={false}
      animation={false}
      fullscreen
      contentClassName="app-modal preset-editor"
      aria-labelledby="edit-presets-heading"
    >
      <Modal.Header>
        <Modal.Title as="h2" id="edit-presets-heading">
          Edit presets
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {draft && draft.length > 0 ? (
          <ListGroup as="ol">
            {draft.map((preset, index) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                isSoundMissing={isSoundMissing(preset)}
                canMoveUp={!isSaving && index > 0}
                canMoveDown={!isSaving && index < draft.length - 1}
                canRemove={!isSaving}
                onMove={(by) => move(preset.id, by)}
                onRemove={() => remove(preset.id)}
              />
            ))}
          </ListGroup>
        ) : (
          <p className="empty-state mb-0">No presets</p>
        )}

        {error && (
          <Alert variant="danger" className="compact-alert" aria-live="polite">
            {error}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline-dark"
          disabled={isSaving}
          onClick={cancelEditing}
        >
          Cancel
        </Button>
        <Button
          variant="dark"
          className="icon-label-button"
          disabled={isSaving}
          onClick={finishEditing}
        >
          {isSaving && (
            <Spinner animation="border" size="sm" aria-hidden="true" />
          )}
          {isSaving ? "Saving" : "Done"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

interface PresetRowProps {
  preset: Preset;
  isSoundMissing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

function PresetRow({
  preset,
  isSoundMissing,
  canMoveUp,
  canMoveDown,
  canRemove,
  onMove,
  onRemove,
}: PresetRowProps) {
  const Icon = presetIcons[preset.icon];
  const style = { "--preset-color": preset.light?.color } as CSSProperties;

  return (
    <ListGroup.Item as="li" className="preset-edit-row">
      <span className="preset-icon preset-icon-small" style={style}>
        <Icon aria-hidden="true" />
      </span>
      <span className="preset-edit-text">
        <span className="preset-name">{preset.name}</span>
        <small
          className={isSoundMissing ? "text-danger" : "text-body-secondary"}
        >
          {preset.sound === null
            ? "No sound"
            : isSoundMissing
              ? `${preset.sound} isn't on the SD card`
              : preset.sound}
        </small>
      </span>
      <span className="preset-edit-actions">
        <Button
          variant="light"
          aria-label={`Move ${preset.name} up`}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          variant="light"
          aria-label={`Move ${preset.name} down`}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          variant="light"
          aria-label={`Delete ${preset.name}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </span>
    </ListGroup.Item>
  );
}
