import { defineConfig } from "vite";

// Set this to your ESP32's hostname or IP for dev proxy
const ESP32_HOST = process.env.ESP32_HOST || "pumpkin.local";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "../.littlefs",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: `http://${ESP32_HOST}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://${ESP32_HOST}:81`,
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
});
