import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(currentDir, "src", "renderer"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(currentDir, "dist", "renderer"),
    emptyOutDir: true
  }
});
