import { defineConfig } from "vite";

export default defineConfig({
  root: ".", // current folder
  build: {
    outDir: "dist", // build output
  },
  server: {
    port: 5173,
  },
});
