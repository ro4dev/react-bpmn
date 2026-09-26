/**
 * Tests de browser (Playwright).
 *
 * Cubre lo que los tests de API **no** pueden ver: que la app montada en un
 * navegador real llegue a la sesión, que no salte el redirect a /login y que el
 * panel muestre lo que tiene que mostrar. Ya compensó un bug que ninguna suite
 * había visto: al recargar, dos `POST /auth/refresh` simultáneos (StrictMode
 * monta dos veces el efecto) hacían que el segundo recibiera 401 —la rotación de
 * refresh tokens invalida el viejo— y eso borraba la sesión recién creada,
 * dejando al usuario en /login sin ningún error visible.
 *
 * Cada corrida usa una **DB temporal propia** y un puerto de API aparte, así que
 * no toca los datos de desarrollo ni los servidores que tengas levantados.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

import { E2E_API_PORT, E2E_DB_PATH, E2E_JWT_SECRET, E2E_WEB_PORT } from "./e2e/demo-db";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const API_PORT = E2E_API_PORT;
const WEB_PORT = E2E_WEB_PORT;

export default defineConfig({
  testDir: "./e2e",
  // Un fallo de red muchas veces es un puerto ocupado: reintentar una vez hace
  // que la suite sea confiable sin esconder bugs reales.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Usamos el Chrome del sistema: no hace falta bajar otro browser.
    channel: "chrome",
    headless: true,
    actionTimeout: 10_000,
    trace: "retain-on-failure",
  },

  globalSetup: "./e2e/global-setup.ts",

  // La primera carga con Vite en frío transforma cientos de módulos y puede
  // tardar más que los 5s por default; no es un bug de la app.
  expect: { timeout: 15_000 },

  webServer: [
    {
      command: "server/node_modules/.bin/tsx server/src/index.ts",
      cwd: root,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DB_PATH: E2E_DB_PATH, JWT_SECRET: E2E_JWT_SECRET, PORT: String(API_PORT) },
    },
    {
      command: `node_modules/.bin/vite --port ${WEB_PORT} --strictPort`,
      cwd: here,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
