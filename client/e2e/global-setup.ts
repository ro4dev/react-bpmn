/**
 * Verificación de la corrida de browser: que la base esté sembrada y que la API
 * que levantaron los `webServer` sirva **esa** base.
 *
 * No siembra: el sembrado va en el paso previo (`npm run pretest:ui`), porque
 * Playwright abre la base al arrancar la API, antes del `globalSetup`. Ver
 * `demo-db.ts` para el detalle de por qué el orden importa tanto.
 *
 * Sirve de red de seguridad para dos cosas que mufflan los tests:
 * - que el seed no haya corrido, o haya corrido a medias;
 * - que la API esté sirviendo una base vieja (inode de una corrida anterior), en
 *   cuyo caso los tests leerían datos que no corresponden al código y fallarían
 *   por el motivo equivocado.
 */
import {
  DEMO_USER,
  E2E_API_PORT,
  EXPECTED_PROCESSES,
  readDbProcessNames,
} from "./demo-db";

/**
 * Cómo matar el server huérfano. El `pkill` es broad a propósito: si apuntás
 * solo al puerto 4100 vas a tener que adivinar el PID, y el proceso es
 * distinguible por el puerto que tiene asignado.
 */
const API_KILL_HINT = 'pkill -f "tsx.*src/index.ts"';

/** Espera a que la API de los tests responda. */
async function waitForApi(timeoutMs = 20_000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      const res = await fetch(`http://localhost:${E2E_API_PORT}/api/health`);
      if (res.ok) return;
    } catch {
      // Todavía no está: se reintenta.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `La API de los tests (puerto ${E2E_API_PORT}) no respondió /api/health en ${timeoutMs}ms.\n` +
      `Si quedó un server vivo de una corrida anterior, ocupá el puerto:  ${API_KILL_HINT}`,
  );
}

/** Nombres de procesos que devuelve la API con un login real de demo. */
async function readApiProcessNames(): Promise<string[]> {
  const login = await fetch(`http://localhost:${E2E_API_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: DEMO_USER.email, password: DEMO_USER.password }),
  });
  if (!login.ok) {
    throw new Error(`El login demo contra la API de los tests devolvió ${login.status}.`);
  }
  const { accessToken } = (await login.json()) as { accessToken: string };
  const res = await fetch(`http://localhost:${E2E_API_PORT}/api/processes`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`El listado de procesos devolvió ${res.status}.`);
  }
  const lista = (await res.json()) as { name: string }[];
  return lista.map((p) => p.name).sort();
}

export default async function globalSetup(): Promise<void> {
  // 1. La base en disco tiene que estar sembrada con el catálogo completo.
  if (readDbProcessNames().length !== EXPECTED_PROCESSES) {
    throw new Error(
      `La base de los tests no quedó sembrada (faltaría correr el paso previo).\n` +
        `Corre los tests con  npm run test:ui  (o  npm test  desde la raíz), que siembra antes de levantar los servidores.`,
    );
  }

  // 2. La API tiene que estar sirviendo ESA base, no una de una corrida anterior.
  await waitForApi();
  const enDisco = readDbProcessNames();
  const enLaApi = await readApiProcessNames();

  if (enDisco.join("|") !== enLaApi.join("|")) {
    const soloEnDisco = enDisco.filter((n) => !enLaApi.includes(n));
    const soloEnLaApi = enLaApi.filter((n) => !enDisco.includes(n));
    throw new Error(
      `La API de los tests (puerto ${E2E_API_PORT}) no está sirviendo la base sembrada.\n` +
        `En disco hay ${enDisco.length} procesos y la API devuelve ${enLaApi.length}.\n` +
        (soloEnDisco.length > 0 ? `Solo en disco: ${soloEnDisco.slice(0, 3).join(", ")}…\n` : "") +
        (soloEnLaApi.length > 0 ? `Solo en la API: ${soloEnLaApi.slice(0, 3).join(", ")}…\n` : "") +
        `Causa probable: quedó un server vivo de una corrida anterior, con el archivo de la base viejo abierto.\n` +
        `Matalo y volvé a correr:  ${API_KILL_HINT}`,
    );
  }
}
