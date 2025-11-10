import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".", // Keep current folder as root
  build: {
    outDir: "dist", // Output folder
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        signin: resolve(__dirname, "signin.html"),
        profile: resolve(__dirname, "profile.html"),
        verifyOtp: resolve(__dirname, "verify-otp.html"),
        forgot: resolve(__dirname, "forgot.html"),
        home: resolve(__dirname, "home.html"),
      },
    },
  },
  server: {
    port: 5173,
  },
});
