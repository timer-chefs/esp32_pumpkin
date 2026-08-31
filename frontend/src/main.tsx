import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Expected #root to exist");
}

createRoot(root).render(<App />);
