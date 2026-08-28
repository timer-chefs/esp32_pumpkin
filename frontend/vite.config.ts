import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const esp32Host = environment.ESP32_HOST || "pumpkin.local";

  return {
    root: ".",
    publicDir: "public",
    build: {
      outDir: "../.littlefs",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "/api": {
          target: `http://${esp32Host}`,
          changeOrigin: true,
        },
        "/ws": {
          target: `ws://${esp32Host}:81`,
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  };
});
