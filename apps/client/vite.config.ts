import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    proxy: {
      "/api": { target: "http://localhost:8792", ws: true },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // Three.js with the WebGPU renderer is most of this; it is cached after the first load.
    chunkSizeWarningLimit: 1200,
  },
});
