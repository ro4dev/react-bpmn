import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// El destino del proxy se puede pisar con API_TARGET: los tests de browser
// levantan una API aparte (puerto y DB propios) y no deben pegarle a la de
// desarrollo.
const apiTarget = process.env.API_TARGET ?? "http://localhost:4000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "../shared/src"),
    },
  },
  server: {
    // El client llama a /api/* y Vite lo redirige al server local
    proxy: {
      "/api": apiTarget,
    },
  },
});
