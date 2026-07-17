import { defineConfig } from "vite";

// Set this to your ESP32's IP address for dev proxy
const ESP32_HOST = process.env.ESP32_HOST || "192.168.1.100";

export default defineConfig({
    root: ".",
    publicDir: "public",
    build: {
        outDir: "../.littlefs",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // TODO: Remove file name overrides once we can serve any file
                // name from the ESP32
                entryFileNames: "main.js",
                chunkFileNames: "[name].js",
                assetFileNames: "styles.[ext]",
            },
        },
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
            },
        },
    },
});
