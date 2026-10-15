import { Mic } from "lucide-react";
import { useEffect, type KeyboardEvent, type PointerEvent } from "react";
import { Button, Spinner } from "react-bootstrap";

import { useAudioSource } from "./audio_source_slice.ts";
import "./push_to_talk.css";

const TALK_KEYS = new Set([" ", "Enter"]);

export function PushToTalkButton() {
  const { pushToTalk, pressToTalk, releaseToTalk } = useAudioSource();
  const isPressed = pushToTalk !== null;

  // Switching away mid-press may never deliver the release, and a
  // microphone left streaming is the one thing this button mustn't do.
  useEffect(() => {
    if (!isPressed) {
      return;
    }

    const releaseWhenHidden = () => {
      if (document.hidden) {
        releaseToTalk();
      }
    };
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", releaseWhenHidden);
  }, [isPressed, releaseToTalk]);

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    // Keeps the release coming here even if the finger slides off.
    event.currentTarget.setPointerCapture(event.pointerId);
    pressToTalk();
  };

  const pressKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (TALK_KEYS.has(event.key) && !event.repeat) {
      event.preventDefault();
      pressToTalk();
    }
  };

  const releaseKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (TALK_KEYS.has(event.key)) {
      event.preventDefault();
      releaseToTalk();
    }
  };

  return (
    <Button
      variant={isPressed ? "danger" : "dark"}
      className={`push-to-talk ${pushToTalk === "talking" ? "push-to-talk--live" : ""}`}
      aria-pressed={isPressed}
      onPointerDown={press}
      onPointerUp={releaseToTalk}
      onPointerCancel={releaseToTalk}
      onLostPointerCapture={releaseToTalk}
      onKeyDown={pressKey}
      onKeyUp={releaseKey}
      onBlur={releaseToTalk}
      onContextMenu={(event) => event.preventDefault()}
    >
      {pushToTalk === "starting" ? (
        <Spinner animation="border" size="sm" aria-hidden="true" />
      ) : (
        <Mic aria-hidden="true" />
      )}
      {pushToTalk === "talking"
        ? "Talking"
        : pushToTalk === "starting"
          ? "Starting microphone"
          : "Hold to talk"}
    </Button>
  );
}
