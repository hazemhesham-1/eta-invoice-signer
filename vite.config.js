import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        }
    },
    server: {
        clearScreen: false,
        watch: {
            ignored: ["**/src-tauri/**", "**/node_modules/**"]
        }
    }
});