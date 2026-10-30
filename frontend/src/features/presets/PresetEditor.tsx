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
import {
  Alert,
  Badge,
  Button,
  ListGroup,
  Modal,
  Spinner,
} from "react-bootstrap";

import { PresetForm } from "./PresetForm.tsx";
import { PresetIconImage } from "./PresetIconImage.tsx";
import "./presets.css";
import { changeTo, hasChanges, newPreset, type Preset } from "./presets.ts";
import { usePresets } from "./presets_slice.ts";
import { useIsSoundMissing } from "./use_is_sound_missing.ts";

/**
 * Where the presets are added, changed, put in order and taken away.
 * Nothing reaches the card until Save, so Cancel takes back all of it.
 */
export function PresetEditor() {
  const {
    presets,
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
  const hasUnsavedChanges =
    draft !== null && presets !== null && hasChanges(draft, presets);
  // The preset open in the form, rather than the list of them all, and how
  // it was before, for Cancel to put back. Null for one that Add preset has
  // only just made, which Cancel takes away again.
  const [open, setOpen] = useState<{ id: string; before: Preset | null }>();
  const openPreset = draft?.find((preset) => preset.id === open?.id) ?? null;

  // The preset waiting on a yes before it's deleted.
  const [deleting, setDeleting] = useState<Preset | null>(null);

  const leave = (action: () => void) => {
    setOpen(undefined);
    action();
  };

  const confirmDelete = () => {
    if (!deleting) {
      return;
    }

    remove(deleting.id);
    if (open?.id === deleting.id) {
      setOpen(undefined);
    }
    setDeleting(null);
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
    <>
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
                      change={presets && changeTo(preset, presets)}
                      canMoveUp={!isSaving && index > 0}
                      canMoveDown={!isSaving && index < draft.length - 1}
                      isSaving={isSaving}
                      onOpen={() => setOpen({ id: preset.id, before: preset })}
                      onMove={(by) => move(preset.id, by)}
                      onRemove={() => setDeleting(preset)}
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
            <Alert
              variant="danger"
              className="compact-alert"
              aria-live="polite"
            >
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
                onClick={() => setDeleting(openPreset)}
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
              {/* Quiet until there's something to save. It still saves
                  presets that haven't changed, which a card without a
                  file of them needs. */}
              <Button
                variant={hasUnsavedChanges ? "dark" : "outline-dark"}
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
                {hasUnsavedChanges && !isSaving && (
                  <span className="unsaved-dot" aria-hidden="true" />
                )}
              </Button>
            </Fragment>
          )}
        </Modal.Footer>
      </Modal>

      <Modal
        show={deleting !== null}
        onHide={() => setDeleting(null)}
        centered
        animation={false}
        // Over the editor, which is a modal of its own.
        className="confirm-modal"
        backdropClassName="confirm-backdrop"
        contentClassName="app-modal"
        aria-labelledby="delete-preset-heading"
      >
        <Modal.Header>
          <Modal.Title as="h2" id="delete-preset-heading">
            Delete {displayName(deleting)}?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          It's deleted from the SD card when the presets are saved.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-dark"
            className="icon-label-button"
            onClick={() => setDeleting(null)}
          >
            <X aria-hidden="true" />
            Keep it
          </Button>
          <Button
            variant="danger"
            className="icon-label-button"
            onClick={confirmDelete}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

interface PresetRowProps {
  preset: Preset;
  isSoundMissing: boolean;
  /** What editing has done to it, if anything. */
  change: "new" | "changed" | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isSaving: boolean;
  onOpen: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

const changeLabels = { new: "New", changed: "Changed" };

function PresetRow({
  preset,
  isSoundMissing,
  change,
  canMoveUp,
  canMoveDown,
  isSaving,
  onOpen,
  onMove,
  onRemove,
}: PresetRowProps) {
  const style = { "--preset-color": preset.light?.color } as CSSProperties;
  const name = displayName(preset);

  return (
    <ListGroup.Item
      as="li"
      className={`preset-edit-row ${change ? `is-${change}` : ""}`}
    >
      <button
        type="button"
        className="preset-edit-open"
        aria-label={
          change
            ? `Change ${name} (${changeLabels[change].toLowerCase()})`
            : `Change ${name}`
        }
        disabled={isSaving}
        onClick={onOpen}
      >
        <span className="preset-icon preset-icon-small" style={style}>
          <PresetIconImage name={preset.icon} />
        </span>
        <span className="preset-edit-text">
          <span className="preset-edit-title">
            <span className="preset-name">{name}</span>
            {change && (
              <Badge
                pill
                bg={change === "new" ? "success" : "warning"}
                text={change === "new" ? undefined : "dark"}
              >
                {changeLabels[change]}
              </Badge>
            )}
          </span>
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

function displayName(preset: Preset | null): string {
  return preset?.name.trim() || "Unnamed";
}
