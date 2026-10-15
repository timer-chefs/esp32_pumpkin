import { Keyboard } from "lucide-react";
import { useState } from "react";
import { Button, Modal } from "react-bootstrap";

import { SpeechControl } from "./SpeechControl.tsx";

/** Opens a form to type something for the pumpkin to say. */
export function SpeechButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <>
      <Button
        variant="dark"
        className="voice-side-button"
        onClick={() => setIsOpen(true)}
      >
        <Keyboard aria-hidden="true" />
        Type
      </Button>

      <Modal
        show={isOpen}
        onHide={() => setIsOpen(false)}
        animation={false}
        contentClassName="app-modal"
        aria-labelledby="speech-heading"
      >
        <Modal.Header closeButton>
          <Modal.Title as="h2" id="speech-heading">
            Say
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <SpeechControl text={text} onTextChange={setText} />
        </Modal.Body>
      </Modal>
    </>
  );
}
