import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const esp32Host = environment.ESP32_HOST || "pumpkin.local";

  return {
    root: ".",
    publicDir: "public",
    plugins: [react()],
    build: {
      outDir: "../.littlefs",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "/api": {
          target: `https://${esp32Host}`,
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: `wss://${esp32Host}`,
          ws: true,
          secure: false,
          rewriteWsOrigin: true,
        },
      },
    },
  };
});
