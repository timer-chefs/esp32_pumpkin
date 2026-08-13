import { defineConfig } from "vite";

// Set this to your ESP32's IP address for dev proxy
const ESP32_HOST = process.env.ESP32_HOST || "192.168.1.100";

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
