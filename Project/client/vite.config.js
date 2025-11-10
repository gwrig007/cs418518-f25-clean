import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";

const htmlFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".html"))
  .reduce((inputs, file) => {
    inputs[file.replace(".html", "")] = resolve(__dirname, file);
    return inputs;
  }, {});

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: htmlFiles,
    },
  },
  server: {
    port: 5173,
  },
});
