import { Container } from "react-bootstrap";

import { AppContextProvider } from "./app/app_context.tsx";
import { useAppController } from "./app/app_controller.ts";
import { usePage } from "./app/page.ts";
import { AppHeader } from "./components/AppHeader.tsx";
import { PageNav } from "./components/PageNav.tsx";
import { AudioSourceControl } from "./features/audio_source/AudioSourceControl.tsx";
import { PushToTalkButton } from "./features/audio_source/PushToTalkButton.tsx";
import { EyeCalibration } from "./features/calibration/EyeCalibration.tsx";
import { EyeControl } from "./features/eye/EyeControl.tsx";
import { DeviceLog } from "./features/log/DeviceLog.tsx";
import { PresetGrid } from "./features/presets/PresetGrid.tsx";
import { VolumeControl } from "./features/volume/VolumeControl.tsx";

export function App() {
  const controller = useAppController();
  const page = usePage();

  // Every page stays mounted, so what's half done on one (a file picked but
  // not yet uploaded, say) is still there after a look at another.
  return (
    <AppContextProvider value={controller}>
      <main className="app-shell min-vh-100">
        <Container className="app-container py-4 py-lg-5">
          <AppHeader />
          <PageNav page={page} />

          <div hidden={page !== "presets"}>
            <PresetGrid />
            <EyeControl />
            <PushToTalkButton />
          </div>

          <div hidden={page !== "audio"}>
            <AudioSourceControl />

            <div className="utility-grid">
              <VolumeControl />
            </div>
          </div>

          <div hidden={page !== "calibration"}>
            <EyeCalibration />
          </div>

          <div hidden={page !== "log"}>
            <DeviceLog />
          </div>
        </Container>
      </main>
    </AppContextProvider>
  );
}
