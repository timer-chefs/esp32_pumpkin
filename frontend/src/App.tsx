import { useEffect, useSyncExternalStore } from "react";
import {
  FileAudio,
  FolderOpen,
  Ghost,
  Mic,
  Minus,
  Plus,
  Square,
  Volume2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Container,
  Form,
  Row,
  Stack,
} from "react-bootstrap";

import { stopAudio } from "./audio_cleanup.ts";
import {
  onFileSelected,
  streamSelectedFile,
  switchToFile,
} from "./audio_file_controller.ts";
import { getAudioUiState, subscribeToAudioUi } from "./audio_ui.ts";
import {
  decreaseVolume,
  increaseVolume,
  loadVolume,
} from "./audio_volume_control.ts";
import { handleSelectAudioFolder } from "./folder_manager.ts";
import { stopMicrophone, switchToMicrophone } from "./microphone_controller.ts";
import { presetShows } from "./preset_shows.ts";
import type { PresetShow } from "./preset_shows.ts";
import { playShow } from "./show_controller.ts";

const ghostShow = getPresetShow("Ghost");

export function App() {
  const ui = useSyncExternalStore(
    subscribeToAudioUi,
    getAudioUiState,
    getAudioUiState,
  );

  useEffect(() => {
    runAction(loadVolume);
  }, []);

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <Container className="app-container py-4 py-lg-5">
        <header className="border-bottom pb-4 mb-4">
          <Row className="align-items-end g-4">
            <Col lg={7}>
              <Badge bg="warning" text="dark" className="mb-2">
                ESP32 audio controller
              </Badge>
              <h1 className="display-4 fw-bold mb-0">Pumpkin Audio</h1>
            </Col>
            <Col lg={5}>
              <Card bg="dark" text="white" aria-live="polite">
                <Card.Body>
                  <Stack direction="horizontal" gap={3}>
                    <span className="status-dot" aria-hidden="true" />
                    <div>
                      <small className="d-block text-white-50">
                        Current mode
                      </small>
                      <strong>{ui.currentMode}</strong>
                    </div>
                    {ui.currentStreaming && (
                      <div className="ms-auto text-end overflow-hidden">
                        <small className="d-block text-white-50">
                          Streaming
                        </small>
                        <strong className="d-block text-truncate">
                          {ui.currentStreaming}
                        </strong>
                      </div>
                    )}
                  </Stack>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </header>

        <section className="mb-4" aria-labelledby="source-heading">
          <Stack
            direction="horizontal"
            className="align-items-end justify-content-between mb-3"
            gap={3}
          >
            <div>
              <Badge bg="secondary" className="mb-2">
                01
              </Badge>
              <h2 id="source-heading" className="h4 mb-0">
                Choose a source
              </h2>
            </div>
            <p className="text-body-secondary text-end mb-0 d-none d-sm-block">
              Send live microphone input or a local audio file.
            </p>
          </Stack>

          <Row xs={1} md={2} className="g-3">
            <Col>
              <Button
                variant={
                  ui.activePanel === "microphone" ? "success" : "outline-dark"
                }
                className="source-button w-100 d-flex align-items-center gap-3 text-start"
                disabled={ui.activePanel === "microphone"}
                onClick={() => runAction(switchToMicrophone)}
              >
                <Mic aria-hidden="true" />
                <span>
                  <strong className="d-block">Microphone</strong>
                  <small>Stream live audio</small>
                </span>
              </Button>
            </Col>
            <Col>
              <Button
                variant={ui.activePanel === "file" ? "success" : "outline-dark"}
                className="source-button w-100 d-flex align-items-center gap-3 text-start"
                disabled={ui.activePanel === "file"}
                onClick={() => runAction(switchToFile)}
              >
                <FileAudio aria-hidden="true" />
                <span>
                  <strong className="d-block">Audio file</strong>
                  <small>Play a local recording</small>
                </span>
              </Button>
            </Col>
          </Row>

          <Card className="source-workspace mt-3 bg-body-secondary">
            <Card.Body>
              <p
                className="text-body-secondary text-center my-4"
                hidden={ui.activePanel !== null}
              >
                Select an audio source to begin.
              </p>

              <Stack
                direction="horizontal"
                className="justify-content-between flex-wrap gap-3 py-3"
                hidden={ui.activePanel !== "microphone"}
              >
                <Stack direction="horizontal" gap={3}>
                  <span className="status-dot" aria-hidden="true" />
                  <strong>Streaming microphone audio</strong>
                </Stack>
                <Button
                  variant="danger"
                  className="d-inline-flex align-items-center gap-2"
                  onClick={() => runAction(stopMicrophone)}
                >
                  <Square aria-hidden="true" />
                  Stop
                </Button>
              </Stack>

              <div hidden={ui.activePanel !== "file"}>
                <Form.Group controlId="audio-file">
                  <Form.Label className="fw-semibold">
                    Select an audio file
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="audio/*"
                    onChange={(event) =>
                      onFileSelected(
                        (event.currentTarget as HTMLInputElement).files?.[0] ??
                          null,
                      )
                    }
                  />
                  <Form.Text>
                    Choose any browser-supported audio format.
                  </Form.Text>
                </Form.Group>
                {ui.fileStatus && (
                  <Alert
                    variant={
                      ui.fileStatus.tone === "success" ? "success" : "light"
                    }
                    className="py-2 mt-3 mb-0"
                    aria-live="polite"
                  >
                    {ui.fileStatus.message}
                  </Alert>
                )}
                <Stack direction="horizontal" gap={2} className="mt-3">
                  <Button
                    variant="warning"
                    className="d-inline-flex align-items-center gap-2"
                    disabled={!ui.streamFileEnabled}
                    onClick={() => runAction(streamSelectedFile)}
                  >
                    <Volume2 aria-hidden="true" />
                    Stream file
                  </Button>
                  <Button
                    variant="danger"
                    className="d-inline-flex align-items-center gap-2"
                    onClick={() => runAction(stopAudio)}
                  >
                    <Square aria-hidden="true" />
                    Stop
                  </Button>
                </Stack>
              </div>
            </Card.Body>
          </Card>
        </section>

        <Row xs={1} lg={2} className="g-4">
          <Col>
            <Card className="h-100">
              <Card.Body>
                <Badge bg="secondary" className="mb-2">
                  02
                </Badge>
                <Card.Title as="h2" id="volume-heading" className="h4 mb-4">
                  Output volume
                </Card.Title>
                <div className="d-flex justify-content-center">
                  <ButtonGroup aria-label="Output volume controls">
                    <Button
                      variant="outline-secondary"
                      className="icon-button"
                      aria-label="Decrease volume"
                      title="Decrease volume"
                      onClick={() => runAction(decreaseVolume)}
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <div className="volume-readout border-top border-bottom bg-body px-4 d-flex align-items-baseline justify-content-center gap-2">
                      <strong>{Math.round(ui.volume * 100)}</strong>
                      <small className="text-body-secondary">percent</small>
                    </div>
                    <Button
                      variant="outline-secondary"
                      className="icon-button"
                      aria-label="Increase volume"
                      title="Increase volume"
                      onClick={() => runAction(increaseVolume)}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  </ButtonGroup>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col>
            <Card className="h-100">
              <Card.Body>
                <Badge bg="secondary" className="mb-2">
                  03
                </Badge>
                <Card.Title as="h2" id="shows-heading" className="h4 mb-4">
                  Preset show
                </Card.Title>
                <div className="d-grid gap-3">
                  <Button
                    variant="outline-secondary"
                    className="d-flex align-items-center justify-content-center gap-2"
                    onClick={() => runAction(handleSelectAudioFolder)}
                  >
                    <FolderOpen aria-hidden="true" />
                    Select audio folder
                  </Button>
                  {ui.folderStatus && (
                    <Alert
                      variant={
                        ui.folderStatus === "success" ? "success" : "danger"
                      }
                      className="py-2 mb-0"
                    >
                      {ui.folderStatus === "success"
                        ? "Audio folder selected"
                        : "Failed to select folder"}
                    </Alert>
                  )}
                  <Button
                    variant="success"
                    className="show-button d-flex align-items-center gap-3 text-start"
                    onClick={() => runAction(() => playShow(ghostShow))}
                  >
                    <Ghost aria-hidden="true" />
                    <span>
                      <strong className="d-block">Ghost</strong>
                      <small>Run preset show</small>
                    </span>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </main>
  );
}

function runAction(action: () => void | Promise<void>): void {
  try {
    Promise.resolve(action()).catch(reportActionError);
  } catch (error) {
    reportActionError(error);
  }
}

function reportActionError(error: unknown): void {
  console.error("Action failed:", error);
}

function getPresetShow(name: string): PresetShow {
  const show = presetShows.find((preset) => preset.name === name);
  if (!show) {
    throw new Error(`Expected a preset show named "${name}"`);
  }

  return show;
}
