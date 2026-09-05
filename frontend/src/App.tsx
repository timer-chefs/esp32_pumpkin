import { Container } from "react-bootstrap";

import { AppContextProvider } from "./app/app_context.tsx";
import { useAppController } from "./app/app_controller.ts";
import { AppHeader } from "./components/AppHeader.tsx";
import { AudioSourceControl } from "./features/audio_source/AudioSourceControl.tsx";
import { PresetShowControl } from "./features/preset_shows/PresetShowControl.tsx";
import { VolumeControl } from "./features/volume/VolumeControl.tsx";

export function App() {
  const controller = useAppController();

  return (
    <AppContextProvider value={controller}>
      <main className="app-shell min-vh-100">
        <Container className="app-container py-4 py-lg-5">
          <AppHeader />
          <AudioSourceControl />

          <div className="utility-grid">
            <VolumeControl />
            <PresetShowControl />
          </div>
        </Container>
      </main>
    </AppContextProvider>
  );
}
