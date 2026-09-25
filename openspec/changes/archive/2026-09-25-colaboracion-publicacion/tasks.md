# Tasks

## 1. Auth + usuarios (server)

- [ ] 1.1 Crear migración en `server/src/db/schema.ts`: tablas `User`, `ProcessCollaborator`, `Invitation` + añadir `ownerId` a `Process` (FK a `User`), índices y FKs. Verificar con smoke `npx tsx` que `CREATE TABLE` + `INSERT`/`SELECT` funciona.
- [ ] 1.2 Crear `server/src/db/authStore.ts`: `createUser(email, password, name)`, `findUserByEmail(email)`, `verifyPassword(user, password)`, `issueTokens(user)` → `{ accessToken, refreshToken }`, `verifyAccessToken(token)`, `verifyRefreshToken(token)`, `rotateRefreshToken(oldToken)`, `revokeRefreshToken(token)`. Usar `bcrypt` (hash/verify) y `jsonwebtoken` (sign/verify). Verificar smoke: registro → login → access token válido → refresh → nuevo access token.
- [ ] 1.3 Crear `server/src/middleware/auth.ts`: `authRequired` (valida `Authorization: Bearer <accessToken>`, setea `req.user`), `optionalAuth` (no falla si no hay token). Verificar que `401` si token inválido/expirado, `403` si usuario borrado.
- [ ] 1.4 Crear `server/src/routes/auth.ts`: `POST /register`, `POST /login`, `POST /refresh`, `GET /me`, `PUT /me`. Montar en `app.ts` bajo `/api/auth`. Validar con smoke: registro → login → `GET /me` → `PUT /me` → `POST /refresh` → nuevo access token.
- [ ] 1.5 Añadir `ownerId` en `Process` (schema + store): `create` setea `ownerId = req.user.id`; `list`/`get`/`update`/`delete` filtran/validan por permisos (ver 2.3). Migración idempotente: `ALTER TABLE Process ADD COLUMN ownerId TEXT REFERENCES User(id)` + backfill opcional.

## 2. Permisos + colaboradores en API de procesos

- [ ] 2.1 Actualizar `server/src/routes/processes.ts`: middleware `authRequired` en todas las rutas; `create` asigna `ownerId`; `get/list/update/delete` validan permiso via helper `can(userId, processId, action)` que consulta `ProcessCollaborator` (cache simple en memoria por request). Verificar: usuario sin permiso → `403`; owner/editor/viewer → según tabla de permisos.
- [ ] 2.2 Crear endpoints de colaboradores en `processes.ts` (o `collaborators.ts`):
  - `POST /api/processes/:id/collaborators` (owner only): `{ email, role }` → si user existe crea `ProcessCollaborator`; si no existe crea `Invitation` + loggea link en consola. Responde `201` con collaborator.
  - `GET /api/processes/:id/collaborators` (owner/editor/viewer): lista colaboradores con email, nombre, rol.
  - `DELETE /api/processes/:id/collaborators/:userId` (owner only): quita colaborador (no se puede quitar al owner).
- [ ] 2.3 Crear `server/src/routes/invitations.ts`: `POST /accept` con `{ token }` → valida JWT firmado (expira 7 días), crea `ProcessCollaborator`, invalida invitación. Responde `200` con collaborator. Montar en `app.ts` bajo `/api/invitations`.
- [ ] 2.4 Extender `server/src/db/processStore.ts`: métodos `setCollaborators(processId, collaborators[])`, `getCollaborators(processId)`, `addCollaborator(processId, userId, role)`, `removeCollaborator(processId, userId)`, `canAccess(userId, processId, action)`. Verificar smoke: crear proceso → invitar user2 como editor → user2 puede `GET/PUT` pero no `DELETE`.

## 3. Modelo compartido + validación auth

- [ ] 3.1 Extender `shared/src/model/types.ts`: añadir `User`, `ProcessCollaborator`, `Invitation`, `Role` (`"owner" | "editor" | "viewer"`), `AuthTokens` (`accessToken`, `refreshToken`? solo server).
- [ ] 3.2 Crear `shared/src/validation/validateAuth.ts`: `validateRegister(input)`, `validateLogin(input)` → `{ valid: boolean, errors: string[] }` (email format, password min 8 chars, etc.). Usar en client y server.

## 4. Client: auth flow + rutas protegidas

- [ ] 4.1 Crear `client/src/context/AuthContext.tsx`: estado `user`, `accessToken`, `isLoading`; `login(email, password)`, `register(...)`, `logout()`, `refresh()`; `accessToken` en memory (variable), `refreshToken` en httpOnly cookie (server) + fallback localStorage si no hay cookie. `fetch` wrapper que inyecta `Authorization: Bearer <accessToken>` y maneja 401 → refresh → retry.
- [ ] 4.2 Crear `client/src/lib/api/auth.ts`: `register`, `login`, `refresh`, `getMe`, `updateMe` tipados.
- [ ] 4.3 Crear `client/src/pages/Login.tsx` + `Register.tsx`: formulario email/password/name, validación client-side (`validateAuth`), llama `auth.login/register`, redirige a `/` (lista) si ok. Estilos consistentes con `ProcessList.css`.
- [ ] 4.4 Crear `client/src/pages/Profile.tsx`: muestra email, nombre, avatar (placeholder), permite editar nombre/avatar. Botón "Cerrar sesión".
- [ ] 4.5 Actualizar `client/src/App.tsx`: `AuthProvider` wrapeado; rutas públicas (`/login`, `/register`) vs protegidas (`/`, `/editor/*`); si no autenticado y ruta protegida → redirect `/login`; header global con avatar + menú (Perfil / Cerrar sesión).
- [ ] 4.6 Actualizar `client/src/features/processes/ProcessList.tsx`: filtro "Mis procesos / Compartidos / Todos"; badge de rol (`owner`/`editor`/`viewer`); solo muestra procesos donde el usuario tiene acceso (server ya filtra, client solo UI).

## 5. Client: compartir + timeline versiones

- [ ] 5.1 Crear `client/src/features/processes/VersionHistory.tsx` + `VersionHistory.css`: panel lateral derecho (abre/cienda desde toolbar), lista versiones DESC (`version`, `comment`, `createdAt`, `authorName`), click → diff visual (nodos/edges added/removed/changed con colores verde/rojo/amarillo), botón "Restaurar esta versión" → POST `/api/processes/:id` con modelo restaurado + comment "Restaurado desde vK". Verificar manual: v1→v2→v3 → abrir historial → click v1 → diff correcto → restaurar → crea v4 con modelo de v1.
- [ ] 5.2 Crear `client/src/features/processes/ShareModal.tsx` + CSS: modal "Compartir proceso" (abre desde toolbar), input email + select role (editor/viewer), lista colaboradores actuales con botón quitar (solo owner). Llama `POST /:id/collaborators` / `DELETE /:id/collaborators/:userId`.
- [ ] 5.3 Actualizar `client/src/features/editor/Toolbar.tsx`: botón "Compartir" (abre ShareModal), botón "Historial" (abre VersionHistory), badge "Owner/Editor/Viewer" según rol actual.
- [ ] 5.4 Actualizar `client/src/lib/api/processes.ts`: añadir `inviteCollaborator`, `listCollaborators`, `removeCollaborator`, `acceptInvitation`.

## 6. ADR, documentación y cierre

- [ ] 6.1 Resolver **AD-008** en `docs/09-decisiones-de-diseno.md` (✅ adoptada Fase 4: auth propia email/password + JWT, bcrypt, permisos por proceso) y agregar **AD-017 (auth JWT own)**, **AD-018 (permisos por proceso)**, **AD-019 (invitación token firmado)**, **AD-020 (timeline versiones UI)**.
- [ ] 6.2 Actualizar `docs/06-backend.md` (auth middleware, rutas auth, schema users/collaborators), `docs/07-api.md` (endpoints auth + collaborators + invitations), `docs/08-modelo-de-datos.md` (entidades User, ProcessCollaborator, Invitation, permisos), `docs/10-roadmap.md` (Fase 4 ✅), `README.md`.
- [ ] 6.3 Correr `npm run lint` (client, server, raíz) 0 errores, `npm run build` client + server OK, `openspec validate --all` 2 passed, marcar tareas completadas, `openspec archive -y colaboracion-publicacion`, commit final + push.