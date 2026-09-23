import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El client llama a /api/* y Vite lo redirige al server local
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});