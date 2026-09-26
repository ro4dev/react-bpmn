/**
 * Smoke test end-to-end de la Fase 4 (auth + colaboración + versiones).
 *
 * Levanta el server en un puerto efímero con una DB temporal y ejercita el
 * flujo completo: registro → crear proceso → invitar → aceptar → permisos →
 * versiones → restaurar. Se corre con `npm --prefix server run test:e2e`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4123;
const BASE = `http://127.0.0.1:${PORT}/api`;

/** Cookie jar minimalista para seguir el refresh token httpOnly. */
const jars = new Map<string, string>();

function cookieHeader(who: string): string {
  return jars.get(who) ?? "";
}

function captureCookies(who: string, res: Response): void {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length === 0) return;
  const jar = new Map(
    (jars.get(who) ?? "")
      .split("; ")
      .filter(Boolean)
      .map((c) => [c.split("=")[0], c]),
  );
  for (const cookie of raw) {
    const pair = cookie.split(";")[0];
    const name = pair.split("=")[0];
    if (cookie.includes("Max-Age=0") || cookie === "") jar.delete(name);
    else jar.set(name, pair);
  }
  jars.set(who, [...jar.values()].join("; "));
}

interface ApiResult {
  status: number;
  body: any;
}

/** Llama a la API como un usuario concreto (propaga el access y la cookie). */
async function api(who: string, path: string, init: RequestInit & { token?: string } = {}): Promise<ApiResult> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const cookie = cookieHeader(who);
  if (cookie) headers.set("Cookie", cookie);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  captureCookies(who, res);
  const text = await res.text();
  if (!text) return { status: res.status, body: null };
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    console.error(`  [respuesta no-JSON de ${path} status ${res.status}]:`, text.slice(0, 200));
    return { status: res.status, body: null };
  }
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const processModel = {
  version: 1,
  nodes: [
    { id: "n1", kind: "start", label: "Inicio", position: { x: 0, y: 0 }, props: {} },
    { id: "n2", kind: "task", label: "Revisar", position: { x: 200, y: 0 }, props: { description: "revisar el pedido", assignee: "Ana" } },
    { id: "n3", kind: "end", label: "Fin", position: { x: 400, y: 0 }, props: {} },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
  ],
};

const modelV2 = {
  version: 1,
  nodes: [
    ...processModel.nodes,
    { id: "n4", kind: "decision", label: "¿Aprobado?", position: { x: 200, y: 150 }, props: {} },
  ],
  // La decisión se encamina al Fin: el validador exige que todo nodo llegue a un Fin.
  edges: [...processModel.edges, { id: "e3", source: "n2", target: "n4" }, { id: "e4", source: "n4", target: "n3" }],
};

async function main(): Promise<void> {
  // 1. Registrar dos usuarios.
  console.log("\n▸ Auth");
  const ana = await api("ana", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "ana@test.com", password: "password123", name: "Ana" }),
  });
  check("registro de Ana", ana.status === 201 && !!ana.body.accessToken, ana);

  const bruno = await api("bruno", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "bruno@test.com", password: "password123", name: "Bruno" }),
  });
  check("registro de Bruno", bruno.status === 201 && !!bruno.body.accessToken, bruno);

  const dup = await api("dup", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "ana@test.com", password: "password123", name: "Ana 2" }),
  });
  check("email duplicado devuelve 409", dup.status === 409, dup);

  const badLogin = await api("x", "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "ana@test.com", password: "malaclave" }),
  });
  check("login con password incorrecta devuelve 401", badLogin.status === 401, badLogin);

  const login = await api("ana", "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "ana@test.com", password: "password123" }),
  });
  check("login correcto", login.status === 200 && !!login.body.accessToken, login);
  const anaToken = login.body.accessToken as string;

  const me = await api("ana", "/auth/me", { token: anaToken });
  check("GET /me devuelve el usuario real", me.body?.email === "ana@test.com" && !!me.body.createdAt, me);

  const refresh = await api("ana", "/auth/refresh", { method: "POST" });
  check("refresh con cookie renueva el access token", refresh.status === 200 && !!refresh.body.accessToken, refresh);
  const anaToken2 = refresh.body.accessToken as string;

  // El token viejo debe seguir siendo válido (los access tokens no rotan).
  const meOld = await api("ana", "/auth/me", { token: anaToken });
  check("el access token anterior sigue válido hasta expirar", meOld.status === 200, meOld);

  // El refresh token anterior fue rotado: reutilizarlo debe fallar.
  const reuse = await api("reuse", "/auth/refresh", { method: "POST" });
  check("el refresh token rotado ya no sirve", reuse.status === 401, reuse);

  // 2. Sin token no hay acceso.
  console.log("\n▸ Autorización");
  const noAuth = await api("nadie", "/processes");
  check("listar sin token devuelve 401", noAuth.status === 401, noAuth);

  // 3. Ana crea un proceso → queda como owner.
  console.log("\n▸ Procesos y versiones");
  const created = await api("ana", "/processes", {
    method: "POST",
    token: anaToken2,
    body: JSON.stringify({ name: "Pedido de compra", model: processModel, comment: "v1" }),
  });
  check("crear proceso", created.status === 201 && created.body.currentVersion === 1, created);
  check("el creador queda como owner", created.body.role === "owner", created.body.role);
  const processId = created.body.id as string;

  const v2 = await api("ana", `/processes/${processId}`, {
    method: "PUT",
    token: anaToken2,
    body: JSON.stringify({ model: modelV2, comment: "agrego la decisión" }),
  });
  check("actualizar crea la v2", v2.status === 200 && v2.body.currentVersion === 2, v2);

  const versions = await api("ana", `/processes/${processId}/versions`, { token: anaToken2 });
  check("el historial tiene 2 versiones", versions.body?.length === 2, versions);

  const restore = await api("ana", `/processes/${processId}/versions/1/restore`, {
    method: "POST",
    token: anaToken2,
    body: "{}",
  });
  check("restaurar v1 crea la v3", restore.status === 200 && restore.body.currentVersion === 3, restore);

  const versionsAfter = await api("ana", `/processes/${processId}/versions`, { token: anaToken2 });
  check("el historial sigue siendo inmutable (3 versiones)", versionsAfter.body?.length === 3, versionsAfter);

  // 4. Colaboración.
  console.log("\n▸ Colaboradores");
  const brunoToken = bruno.body.accessToken as string;
  const blockedBefore = await api("bruno", `/processes/${processId}`, { token: brunoToken });
  check("Bruno no ve el proceso antes de ser invitado", blockedBefore.status === 404, blockedBefore);

  const invite = await api("ana", `/processes/${processId}/collaborators`, {
    method: "POST",
    token: anaToken2,
    body: JSON.stringify({ email: "bruno@test.com", role: "editor" }),
  });
  check("invitar a un usuario registrado lo suma directo", invite.status === 201 && invite.body.kind === "collaborator", invite);

  const nowVisible = await api("bruno", `/processes/${processId}`, { token: brunoToken });
  check("Bruno ahora ve el proceso", nowVisible.status === 200, nowVisible);
  check("Bruno figura como editor", nowVisible.body?.role === "editor", nowVisible.body?.role);

  const brunoSave = await api("bruno", `/processes/${processId}`, {
    method: "PUT",
    token: brunoToken,
    body: JSON.stringify({ model: processModel, comment: "toque de Bruno" }),
  });
  check("un editor puede guardar", brunoSave.status === 200 && brunoSave.body.currentVersion === 4, brunoSave);

  const brunoInvite = await api("bruno", `/processes/${processId}/collaborators`, {
    method: "POST",
    token: brunoToken,
    body: JSON.stringify({ email: "carla@test.com", role: "viewer" }),
  });
  check("un editor NO puede invitar", brunoInvite.status === 403, brunoInvite);

  const brunoDelete = await api("bruno", `/processes/${processId}`, { method: "DELETE", token: brunoToken });
  check("un editor NO puede borrar el proceso", brunoDelete.status === 403, brunoDelete);

  // 5. Invitación a alguien que no existe → token firmado.
  const invitePending = await api("ana", `/processes/${processId}/collaborators`, {
    method: "POST",
    token: anaToken2,
    body: JSON.stringify({ email: "carla@test.com", role: "viewer" }),
  });
  check("invitar a un email desconocido crea una invitación", invitePending.status === 201 && invitePending.body.kind === "invitation", invitePending);
  const inviteToken = invitePending.body?.invitation?.token as string;
  check("la invitación trae un token firmado", typeof inviteToken === "string" && inviteToken.split(".").length === 3);

  const selfInvite = await api("ana", `/processes/${processId}/collaborators`, {
    method: "POST",
    token: anaToken2,
    body: JSON.stringify({ email: "ana@test.com", role: "viewer" }),
  });
  check("invitarse a uno mismo se rechaza", selfInvite.status === 400, selfInvite);

  // 6. Carla se registra y acepta.
  const carla = await api("carla", "/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "carla@test.com", password: "password123", name: "Carla" }),
  });
  const carlaToken = carla.body.accessToken as string;

  const wrongUser = await api("bruno", "/invitations/accept", {
    method: "POST",
    token: brunoToken,
    body: JSON.stringify({ token: inviteToken }),
  });
  check("otro usuario no puede aceptar la invitación", wrongUser.status === 403, wrongUser);

  const tampered = `${inviteToken.slice(0, -3)}xyz`;
  const badAccept = await api("carla", "/invitations/accept", {
    method: "POST",
    token: carlaToken,
    body: JSON.stringify({ token: tampered }),
  });
  check("un token alterado se rechaza", badAccept.status === 400, badAccept);

  const accepted = await api("carla", "/invitations/accept", {
    method: "POST",
    token: carlaToken,
    body: JSON.stringify({ token: inviteToken }),
  });
  check("Carla acepta su invitación", accepted.status === 200 && accepted.body.collaborator.role === "viewer", accepted);

  const reuseInvite = await api("carla", "/invitations/accept", {
    method: "POST",
    token: carlaToken,
    body: JSON.stringify({ token: inviteToken }),
  });
  check("la invitación no se puede aceptar dos veces", reuseInvite.status === 400, reuseInvite);

  const carlaView = await api("carla", `/processes/${processId}`, { token: carlaToken });
  check("Carla (viewer) puede leer", carlaView.status === 200 && carlaView.body.role === "viewer", carlaView);

  const carlaSave = await api("carla", `/processes/${processId}`, {
    method: "PUT",
    token: carlaToken,
    body: JSON.stringify({ model: processModel }),
  });
  check("un viewer NO puede guardar", carlaSave.status === 403, carlaSave);

  const carlaRestore = await api("carla", `/processes/${processId}/versions/1/restore`, {
    method: "POST",
    token: carlaToken,
    body: "{}",
  });
  check("un viewer NO puede restaurar", carlaRestore.status === 403, carlaRestore);

  // 7. Quitar colaborador.
  const collaborators = await api("ana", `/processes/${processId}/collaborators`, { token: anaToken2 });
  check("la lista de colaboradores trae 3 personas", collaborators.body?.collaborators?.length === 3, collaborators.body?.collaborators);
  check("solo el owner puede gestionar", collaborators.body?.canManage === true);

  const brunoId = collaborators.body.collaborators.find((c: any) => c.email === "bruno@test.com").userId;
  const removeOwner = await api("ana", `/processes/${processId}/collaborators/${created.body.collaborator.userId}`, {
    method: "DELETE",
    token: anaToken2,
  });
  check("no se puede quitar al owner", removeOwner.status === 400, removeOwner);

  const removeBruno = await api("ana", `/processes/${processId}/collaborators/${brunoId}`, {
    method: "DELETE",
    token: anaToken2,
  });
  check("el owner puede quitar a un editor", removeBruno.status === 204, removeBruno);

  const brunoAfter = await api("bruno", `/processes/${processId}`, { token: brunoToken });
  check("Bruno pierde el acceso", brunoAfter.status === 404, brunoAfter);

  // 8. Logout.
  const logout = await api("ana", "/auth/logout", { method: "POST", token: anaToken2 });
  check("logout revoca la sesión", logout.status === 204, logout);

  const afterLogout = await api("ana", "/auth/refresh", { method: "POST" });
  check("tras el logout no hay refresh", afterLogout.status === 401, afterLogout);

  console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
  if (failed > 0) process.exitCode = 1;
}

const tmp = mkdtempSync(join(tmpdir(), "react-bpmn-e2e-"));
process.env.DB_PATH = join(tmp, "test.db");
process.env.JWT_SECRET = "secreto-de-test-no-usar-en-produccion-0123456789";
process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";

const { closeStores } = await import("../dist/server/src/db/singleton.js");
await closeStores();

const { app } = await import("../dist/server/src/app.js");
const server = app.listen(PORT);

await new Promise((r) => setTimeout(r, 150));

try {
  await main();
} catch (e) {
  console.error("\nEl test explota:", e);
  failed++;
}

server.close();
closeStores();
rmSync(tmp, { recursive: true, force: true });
process.exit(failed > 0 ? 1 : 0);
