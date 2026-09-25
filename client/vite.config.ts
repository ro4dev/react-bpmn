import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    // El client llama a /api/* y Vite lo redirige al server local
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});