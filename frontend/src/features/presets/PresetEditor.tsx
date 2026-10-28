import {
  ArrowDown,
  ArrowUp,
  Edit,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useState, type CSSProperties } from "react";
import { Alert, Button, ListGroup, Modal, Spinner } from "react-bootstrap";

import { PresetForm } from "./PresetForm.tsx";
import { PresetIconImage } from "./PresetIconImage.tsx";
import "./presets.css";
import { newPreset, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";
import { useIsSoundMissing } from "./use_is_sound_missing.ts";

/**
 * Where the presets are added, changed, put in order and taken away.
 * Nothing reaches the card until Save, so Cancel takes back all of it.
 */
export function PresetEditor() {
  const {
    draft,
    isSaving,
    error,
    add,
    change,
    tryOut,
    move,
    remove,
    finishEditing,
    cancelEditing,
  } = usePresets();
  const isSoundMissing = useIsSoundMissing();
  // The preset open in the form, rather than the list of them all, and how
  // it was before, for Cancel to put back. Null for one that Add preset has
  // only just made, which Cancel takes away again.
  const [open, setOpen] = useState<{ id: string; before: Preset | null }>();
  const openPreset = draft?.find((preset) => preset.id === open?.id) ?? null;

  const leave = (action: () => void) => {
    setOpen(undefined);
    action();
  };

  const cancelPreset = () => {
    if (!open) {
      return;
    }

    if (open.before) {
      const { id, ...before } = open.before;
      change(id, before);
    } else {
      remove(open.id);
    }
    setOpen(undefined);
  };

  return (
    <Modal
      show={draft !== null}
      onHide={() => leave(cancelEditing)}
      // Leaving is Cancel or Save, never a stray Escape that loses the edits.
      backdrop="static"
      keyboard={false}
      animation={false}
      fullscreen
      contentClassName="app-modal preset-editor"
      aria-labelledby="edit-presets-heading"
    >
      <Modal.Header>
        <Modal.Title as="h2" id="edit-presets-heading">
          {openPreset ? "Edit preset" : "Edit presets"}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {openPreset ? (
          <PresetForm
            key={openPreset.id}
            preset={openPreset}
            onChange={(changes) => change(openPreset.id, changes)}
          />
        ) : (
          <>
            {draft && draft.length > 0 ? (
              <ListGroup as="ol">
                {draft.map((preset, index) => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    isSoundMissing={isSoundMissing(preset)}
                    canMoveUp={!isSaving && index > 0}
                    canMoveDown={!isSaving && index < draft.length - 1}
                    isSaving={isSaving}
                    onOpen={() => setOpen({ id: preset.id, before: preset })}
                    onMove={(by) => move(preset.id, by)}
                    onRemove={() => remove(preset.id)}
                  />
                ))}
              </ListGroup>
            ) : (
              <p className="empty-state mb-0">No presets</p>
            )}

            <Button
              variant="outline-dark"
              className="icon-label-button mt-3"
              disabled={isSaving}
              onClick={() => {
                const preset = newPreset();
                add(preset);
                setOpen({ id: preset.id, before: null });
              }}
            >
              <Plus aria-hidden="true" />
              Add preset
            </Button>
          </>
        )}

        {error && (
          <Alert variant="danger" className="compact-alert" aria-live="polite">
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        {/* Keyed apart, so that Save doesn't turn into Try in passing. */}
        {openPreset ? (
          <Fragment key="preset">
            {/* Just the icon, so that all four fit across a phone. */}
            <Button
              variant="outline-danger"
              className="icon-label-button me-auto"
              aria-label="Delete"
              title="Delete"
              onClick={() => leave(() => remove(openPreset.id))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
            <Button
              variant="outline-dark"
              className="icon-label-button"
              onClick={() => tryOut(openPreset.id)}
            >
              <Play aria-hidden="true" />
              Try
            </Button>
            <Button
              variant="outline-dark"
              className="icon-label-button"
              onClick={cancelPreset}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
            <Button
              variant="dark"
              className="icon-label-button"
              onClick={() => setOpen(undefined)}
            >
              Done
            </Button>
          </Fragment>
        ) : (
          <Fragment key="presets">
            <Button
              variant="outline-dark"
              className="icon-label-button"
              disabled={isSaving}
              onClick={() => leave(cancelEditing)}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
            <Button
              variant="dark"
              className="icon-label-button"
              disabled={isSaving}
              onClick={finishEditing}
            >
              {isSaving ? (
                <Spinner animation="border" size="sm" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {isSaving ? "Saving" : "Save"}
            </Button>
          </Fragment>
        )}
      </Modal.Footer>
    </Modal>
  );
}

interface PresetRowProps {
  preset: Preset;
  isSoundMissing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSaving: boolean;
  onOpen: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

function PresetRow({
  preset,
  isSoundMissing,
  canMoveUp,
  canMoveDown,
  isSaving,
  onOpen,
  onMove,
  onRemove,
}: PresetRowProps) {
  const style = { "--preset-color": preset.light?.color } as CSSProperties;
  const name = preset.name.trim() || "Unnamed";

  return (
    <ListGroup.Item as="li" className="preset-edit-row">
      <button
        type="button"
        className="preset-edit-open"
        aria-label={`Change ${name}`}
        disabled={isSaving}
        onClick={onOpen}
      >
        <span className="preset-icon preset-icon-small" style={style}>
          <PresetIconImage name={preset.icon} />
        </span>
        <span className="preset-edit-text">
          <span className="preset-name">{name}</span>
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
      </button>
      <span className="preset-edit-actions">
        <Button
          variant="light"
          aria-label={`Edit ${name}`}
          disabled={isSaving}
          onClick={onOpen}
        >
          <Edit aria-hidden="true" />
        </Button>
        <Button
          variant="light"
          aria-label={`Move ${name} up`}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          variant="light"
          aria-label={`Move ${name} down`}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button
          variant="light"
          aria-label={`Delete ${name}`}
          disabled={isSaving}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </span>
    </ListGroup.Item>
  );
}
