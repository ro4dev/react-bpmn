# Tasks

> Las 24 tareas de este change se implementaron y verificaron. El change se
> archivó **antes** de implementarlas (por eso acá seguían sin marcar); el
> registro se completó recién con el trabajo terminado.
>
> Verificación: `npm run lint` 0 errores · `npm run build` OK (client y server) ·
> `npm --prefix server run test:e2e` 40/40 · `openspec validate --all` 5 passed.

## 1. Auth + usuarios (server)

- [x] 1.1 Crear migración en `server/src/db/schema.ts`: tablas `User`, `ProcessCollaborator`, `Invitation` + añadir `ownerId` a `Process` (FK a `User`), índices y FKs. Verificar con smoke `npx tsx` que `CREATE TABLE` + `INSERT`/`SELECT` funciona.
- [x] 1.2 Crear `server/src/db/authStore.ts`: `createUser(email, password, name)`, `findUserByEmail(email)`, `verifyPassword(user, password)`, `issueTokens(user)` → `{ accessToken, refreshToken }`, `verifyAccessToken(token)`, `verifyRefreshToken(token)`, `rotateRefreshToken(oldToken)`, `revokeRefreshToken(token)`. Usar `bcrypt` (hash/verify) y `jsonwebtoken` (sign/verify). Verificar smoke: registro → login → access token válido → refresh → nuevo access token.
- [x] 1.3 Crear `server/src/middleware/auth.ts`: `authRequired` (valida `Authorization: Bearer <accessToken>`, setea `req.user`), `optionalAuth` (no falla si no hay token). Verificar que `401` si token inválido/expirado, `403` si usuario borrado.
- [x] 1.4 Crear `server/src/routes/auth.ts`: `POST /register`, `POST /login`, `POST /refresh`, `GET /me`, `PUT /me`. Montar en `app.ts` bajo `/api/auth`. Validar con smoke: registro → login → `GET /me` → `PUT /me` → `POST /refresh` → nuevo access token.
- [x] 1.5 Añadir `ownerId` en `Process` (schema + store): `create` setea `ownerId = req.user.id`; `list`/`get`/`update`/`delete` filtran/validan por permisos (ver 2.3). Migración idempotente: `ALTER TABLE Process ADD COLUMN ownerId TEXT REFERENCES User(id)` + backfill opcional.

## 2. Permisos + colaboradores en API de procesos

- [x] 2.1 Actualizar `server/src/routes/processes.ts`: middleware `authRequired` en todas las rutas; `create` asigna `ownerId`; `get/list/update/delete` validan permiso via helper `can(userId, processId, action)` que consulta `ProcessCollaborator` (cache simple en memoria por request). Verificar: usuario sin permiso → `403`; owner/editor/viewer → según tabla de permisos.
- [x] 2.2 Crear endpoints de colaboradores en `processes.ts` (o `collaborators.ts`):
  - `POST /api/processes/:id/collaborators` (owner only): `{ email, role }` → si user existe crea `ProcessCollaborator`; si no existe crea `Invitation` + loggea link en consola. Responde `201` con collaborator.
  - `GET /api/processes/:id/collaborators` (owner/editor/viewer): lista colaboradores con email, nombre, rol.
  - `DELETE /api/processes/:id/collaborators/:userId` (owner only): quita colaborador (no se puede quitar al owner).
- [x] 2.3 Crear `server/src/routes/invitations.ts`: `POST /accept` con `{ token }` → valida JWT firmado (expira 7 días), crea `ProcessCollaborator`, invalida invitación. Responde `200` con collaborator. Montar en `app.ts` bajo `/api/invitations`.
- [x] 2.4 Extender `server/src/db/processStore.ts`: métodos `setCollaborators(processId, collaborators[])`, `getCollaborators(processId)`, `addCollaborator(processId, userId, role)`, `removeCollaborator(processId, userId)`, `canAccess(userId, processId, action)`. Verificar smoke: crear proceso → invitar user2 como editor → user2 puede `GET/PUT` pero no `DELETE`.

## 3. Modelo compartido + validación auth

- [x] 3.1 Extender `shared/src/model/types.ts`: añadir `User`, `ProcessCollaborator`, `Invitation`, `Role` (`"owner" | "editor" | "viewer"`), `AuthTokens` (`accessToken`, `refreshToken`? solo server).
- [x] 3.2 Crear `shared/src/validation/validateAuth.ts`: `validateRegister(input)`, `validateLogin(input)` → `{ valid: boolean, errors: string[] }` (email format, password min 8 chars, etc.). Usar en client y server.

## 4. Client: auth flow + rutas protegidas

- [x] 4.1 Crear `client/src/context/AuthContext.tsx`: estado `user`, `accessToken`, `isLoading`; `login(email, password)`, `register(...)`, `logout()`, `refresh()`; `accessToken` en memory (variable), `refreshToken` en httpOnly cookie (server) + fallback localStorage si no hay cookie. `fetch` wrapper que inyecta `Authorization: Bearer <accessToken>` y maneja 401 → refresh → retry.
- [x] 4.2 Crear `client/src/lib/api/auth.ts`: `register`, `login`, `refresh`, `getMe`, `updateMe` tipados.
- [x] 4.3 Crear `client/src/pages/Login.tsx` + `Register.tsx`: formulario email/password/name, validación client-side (`validateAuth`), llama `auth.login/register`, redirige a `/` (lista) si ok. Estilos consistentes con `ProcessList.css`.
- [x] 4.4 Crear `client/src/pages/Profile.tsx`: muestra email, nombre, avatar (placeholder), permite editar nombre/avatar. Botón "Cerrar sesión".
- [x] 4.5 Actualizar `client/src/App.tsx`: `AuthProvider` wrapeado; rutas públicas (`/login`, `/register`) vs protegidas (`/`, `/editor/*`); si no autenticado y ruta protegida → redirect `/login`; header global con avatar + menú (Perfil / Cerrar sesión).
- [x] 4.6 Actualizar `client/src/features/processes/ProcessList.tsx`: filtro "Mis procesos / Compartidos / Todos"; badge de rol (`owner`/`editor`/`viewer`); solo muestra procesos donde el usuario tiene acceso (server ya filtra, client solo UI).

## 5. Client: compartir + timeline versiones

- [x] 5.1 Crear `client/src/features/processes/VersionHistory.tsx` + `VersionHistory.css`: panel lateral derecho (abre/cienda desde toolbar), lista versiones DESC (`version`, `comment`, `createdAt`, `authorName`), click → diff visual (nodos/edges added/removed/changed con colores verde/rojo/amarillo), botón "Restaurar esta versión" → POST `/api/processes/:id` con modelo restaurado + comment "Restaurado desde vK". Verificar manual: v1→v2→v3 → abrir historial → click v1 → diff correcto → restaurar → crea v4 con modelo de v1.
- [x] 5.2 Crear `client/src/features/processes/ShareModal.tsx` + CSS: modal "Compartir proceso" (abre desde toolbar), input email + select role (editor/viewer), lista colaboradores actuales con botón quitar (solo owner). Llama `POST /:id/collaborators` / `DELETE /:id/collaborators/:userId`.
- [x] 5.3 Actualizar `client/src/features/editor/Toolbar.tsx`: botón "Compartir" (abre ShareModal), botón "Historial" (abre VersionHistory), badge "Owner/Editor/Viewer" según rol actual.
- [x] 5.4 Actualizar `client/src/lib/api/processes.ts`: añadir `inviteCollaborator`, `listCollaborators`, `removeCollaborator`, `acceptInvitation`.

## 6. ADR, documentación y cierre

- [x] 6.1 Resolver **AD-008** en `docs/09-decisiones-de-diseno.md` (✅ adoptada Fase 4: auth propia email/password + JWT, bcrypt, permisos por proceso) y agregar **AD-017 (auth JWT own)**, **AD-018 (permisos por proceso)**, **AD-019 (invitación token firmado)**, **AD-020 (timeline versiones UI)**.
- [x] 6.2 Actualizar `docs/06-backend.md` (auth middleware, rutas auth, schema users/collaborators), `docs/07-api.md` (endpoints auth + collaborators + invitations), `docs/08-modelo-de-datos.md` (entidades User, ProcessCollaborator, Invitation, permisos), `docs/10-roadmap.md` (Fase 4 ✅), `README.md`.
- [x] 6.3 Correr `npm run lint` (client, server, raíz) 0 errores, `npm run build` client + server OK, `openspec validate --all` 2 passed, marcar tareas completadas, `openspec archive -y colaboracion-publicacion`, commit final + push.

---

## Desviaciones respecto al plan

Las decisiones que se tomaron distinto al enunciado de las tareas, con el motivo.
Ninguna es un trabajo pendiente salvo lo último.

| Task | Plan | Implementado | Motivo |
| --- | --- | --- | --- |
| 1.2 | `findUserByEmail` | `findByEmail` | Nombre, no comportamiento. |
| 1.3 | `403` si el usuario fue borrado | `401` solo si el token no valida; un access token de un usuario borrado sigue sirviendo hasta expirar (15 min) | `authRequired` no consulta la DB en cada request a propósito: es un lookup por request que el server evita. El peor caso son 15 min de acceso con un token ya emitido. |
| 2.1 | Sin permiso → `403` | Sin acceso → **`404`**; `403` solo cuando el acceso existe pero la acción no corresponde (p. ej. viewer intenta guardar) | Un `403` confirma que el proceso existe. Con `404` no se revela la existencia de procesos ajenos. El `403` por rol sí se mantiene, porque el usuario ya sabe que existe. |
| 2.1 | Caché del permiso en memoria por request | `canAccess` consulta por llamada | Cada request hace una consulta a la vez (`roleOf` → owner y colaborador), así que la caché no ahorraba nada. A escala de lista es N+1; si aparece el problema, se resuelve con un `JOIN` en `list`. |
| 2.4 | `setCollaborators(processId, collaborators[])` | No se implementó | La UI invita de a uno; un setter en lote no tenía consumidor. En su lugar: `addCollaborator`, `removeCollaborator`, `getCollaborators`, `canAccess`, más `roleOf` y `addCollaboratorDirect`. |
| 4.1 | Fallback a `localStorage` si no hay cookie | Sin fallback; el access token vive solo en memoria | Un refresh token en `localStorage` es accesible a cualquier XSS; la cookie httpOnly no. Sin cookie, la sesión se pierde y el usuario vuelve a hacer login: es el comportamiento correcto. Ver AD-017. |
| 5.1 | La lista de versiones muestra `authorName` | **No se implementó** | `ProcessVersion` no guarda quién creó la versión. Es el único faltante real: agregarlo requiere columna + migración y decisión de si el viewer puede ver el nombre del autor. Ver "Pendientes" abajo. |
| 5.4 | `inviteCollaborator`, `acceptInvitation` en `processes.ts` | `invite`, `listCollaborators`, `removeCollaborator` en `processes.ts`; `acceptInvitation` en `auth.ts` | `acceptInvitation` habla de invitaciones, no de un proceso: va con la autenticación. |
| 6.1 | AD-017 a AD-020 | Se agregó además **AD-021** | Hash SHA-256 para tokens opacos: la primera implementación hasheaba el refresh con bcrypt y comparaba contra el `id` de la fila, así que la rotación no revocaba nada. La decisión merecía su propio ADR. |
| 6.3 | `openspec validate --all` → 2 passed | 5 passed | Las specs de las fases anteriores también cuentan. |

## Pendientes menores

Ninguno bloquea la Fase 4; quedan para cuando se toque el código:

1. **`authorName` en el historial** (5.1) — `ProcessVersion` no registra el autor. El diff y la restauración funcionan; solo falta mostrar quién hizo cada versión.
2. **N+1 en el cálculo de roles** (2.1) — `ProcessStore.list` consulta `roleOf` una vez por proceso. Con muchos procesos por usuario, un `LEFT JOIN` lo resuelve.
3. **`canAccess` sin caché en el mismo request** (2.1) — varias llamadas por request (p. ej. `getMeta` + `getVersion`) repiten el chequeo de rol.
