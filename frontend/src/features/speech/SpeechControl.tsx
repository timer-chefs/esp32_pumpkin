import {
  Ghost,
  type LucideIcon,
  Skull,
  Speech,
  Square,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Alert,
  Button,
  Form,
  ProgressBar,
  Spinner,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from "react-bootstrap";

import type { DownloadProgress } from "./download_cache.ts";
import { effects } from "./effects.ts";
import { useSpeech, type SpeechPhase } from "./speech_slice.ts";
import { voices } from "./voices.ts";
import "./speech.css";

// All of it is worked out before any of it is said, so a long text is a
// long wait.
const MAX_LENGTH = 500;

const effectIcons: Record<string, LucideIcon> = {
  demon: Skull,
  ghost: Ghost,
  witch: WandSparkles,
};

const phaseLabels: Record<SpeechPhase, string> = {
  loading: "Getting the voice ready",
  synthesizing: "Working out how to say it",
  speaking: "Speaking",
};

export function SpeechControl() {
  const {
    voiceId,
    effectId,
    phase,
    download,
    error,
    selectVoice,
    selectEffect,
    say,
    stop,
  } = useSpeech();
  const [text, setText] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    say(text);
  };

  // Enter says it, as in a chat; Shift+Enter still starts a new line.
  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section className="control-section" aria-labelledby="speech-heading">
      <div className="section-heading">
        <h2 id="speech-heading">Say</h2>
        <span className="text-body-secondary">
          Type it, the pumpkin says it
        </span>
      </div>

      <Form onSubmit={submit}>
        <Form.Group controlId="speech-text">
          <Form.Label visuallyHidden>What to say</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={MAX_LENGTH}
            placeholder="I can see you..."
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            onKeyDown={submitOnEnter}
          />
        </Form.Group>
        <ToggleButtonGroup
          type="radio"
          name="speech-effect"
          aria-label="Effect"
          className="speech-effects mt-2"
          value={effectId}
          onChange={selectEffect}
        >
          {effects.map((effect) => {
            const Icon = effectIcons[effect.id] ?? Speech;
            return (
              <ToggleButton
                key={effect.id}
                id={`speech-effect-${effect.id}`}
                value={effect.id}
                variant="outline-dark"
                disabled={phase !== null}
              >
                <Icon aria-hidden="true" />
                {effect.name}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
        <Stack direction="horizontal" gap={2} className="mt-2">
          <Form.Select
            aria-label="Voice"
            className="speech-voice"
            value={voiceId}
            disabled={phase !== null}
            onChange={(event) => selectVoice(event.currentTarget.value)}
          >
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </Form.Select>
          {/* Kept apart by key: were Stop's button to turn into Say's
              while it's being clicked, the click would go on to submit. */}
          {phase === null ? (
            <Button
              key="say"
              type="submit"
              variant="warning"
              className="icon-label-button"
              disabled={!text.trim()}
            >
              <Volume2 aria-hidden="true" />
              Say
            </Button>
          ) : (
            <Button
              key="stop"
              variant="outline-danger"
              className="icon-label-button"
              onClick={stop}
            >
              <Square aria-hidden="true" />
              Stop
            </Button>
          )}
        </Stack>
      </Form>

      {phase && <SpeechStatus phase={phase} download={download} />}

      {error && (
        <Alert variant="danger" className="compact-alert" aria-live="polite">
          {error}
        </Alert>
      )}
    </section>
  );
}

interface SpeechStatusProps {
  phase: SpeechPhase;
  download: DownloadProgress | null;
}

function SpeechStatus({ phase, download }: SpeechStatusProps) {
  if (download) {
    const percentage =
      download.total === 0
        ? 0
        : Math.round((download.loaded / download.total) * 100);

    return (
      <div className="speech-status speech-download" aria-live="polite">
        <span className="text-body-secondary">
          Downloading the voice (only the first time):{" "}
          {toMegabytes(download.loaded)} of {toMegabytes(download.total)} MB
        </span>
        <ProgressBar
          now={percentage}
          label={`${percentage}%`}
          aria-label="Voice download"
        />
      </div>
    );
  }

  return (
    <Stack
      direction="horizontal"
      gap={2}
      className="speech-status"
      aria-live="polite"
    >
      {phase === "speaking" ? (
        <span className="status-dot" aria-hidden="true" />
      ) : (
        <Spinner animation="border" size="sm" aria-hidden="true" />
      )}
      <span>{phaseLabels[phase]}</span>
    </Stack>
  );
}

function toMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0);
}
