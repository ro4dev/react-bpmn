# Proposal

## Why

La Fase 3 entregó persistencia server-side: CRUD de procesos, versionado inmutable (`ProcessVersion`) y listado/búsqueda desde el editor. Pero **no hay usuarios ni autenticación**: cualquiera puede crear/leer/borrar procesos, no hay forma de saber quién creó qué, no se pueden compartir procesos con permisos, y no hay timeline visual de versiones en la UI. Para que la herramienta sirva *en equipo* hace falta **autenticación + autorización + compartir + historial visual**.

## What Changes

- **Autenticación y usuarios** (resuelve AD-008): auth propia **email/password + JWT** (sin depender de OAuth externo por ahora), tabla `User`, hash bcrypt, endpoints `/api/auth/*`. Migración `users` en SQLite.
- **Autorización por proceso**: cada proceso tiene `ownerId` (FK a `User`); permisos `owner | editor | viewer` vía tabla `ProcessCollaborator`. API valida permisos en cada operación (403 si no autorizado).
- **Compartir procesos**: `POST /api/processes/:id/collaborators` (invitar por email/rol), `GET/DELETE` para listar/quitar. Genera link de invitación (token firmado).
- **Timeline de versiones en la UI**: nueva vista/panel `VersionHistory` que consume `GET /:id/versions` + `GET /:id/versions/:v`, permite ver diff visual y **restaurar** una versión anterior (crea nueva versión con ese modelo).
- **Endpoints de usuario**: `GET /api/me` (perfil), `PUT /api/me` (actualizar nombre/avatar).

## Impact

- **`server/`**:
  - Migración `users` + `process_collaborators` en `server/src/db/schema.ts`.
  - `server/src/db/authStore.ts` (crear usuario, hash/verify password, JWT issue/verify).
  - `server/src/db/processStore.ts` → añadir `ownerId` en `Process` + FK; métodos `setCollaborators/getCollaborators`.
  - `server/src/routes/auth.ts` → `POST /register`, `POST /login`, `POST /refresh`, `GET /me`, `PUT /me`.
  - `server/src/routes/processes.ts` → **auth middleware** (validar JWT), añadir `ownerId` en create, validar permisos en read/update/delete, endpoints de collaborators.
  - `server/src/middleware/auth.ts` → JWT verify + attach `req.user`.
  - `server/src/index.ts` → ejecutar migración users/collaborators al arrancar.
  - Deps nuevas: `bcrypt`, `jsonwebtoken`, `@types/bcrypt`, `@types/jsonwebtoken`.
- **`shared/`**:
  - Extender `shared/src/model/types.ts` con `User`, `ProcessCollaborator`, `Role`, `AuthTokens`.
  - `shared/src/validation/validateAuth.ts` (validación simple de email/password).
- **`client/`**:
  - `src/lib/api/auth.ts` + `src/lib/api/processes.ts` (añadir collaborators).
  - `src/context/AuthContext.tsx` (estado usuario, JWT en memory + refresh token en httpOnly cookie / localStorage fallback).
  - `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/Profile.tsx`.
  - `src/features/processes/ProcessList.tsx` → filtro "mis procesos / compartidos", badge de rol.
  - `src/features/processes/VersionHistory.tsx` + CSS (timeline, diff, botón "Restaurar esta versión").
  - `src/App.tsx` → `AuthProvider`, rutas protegidas, header con avatar/logout, redirigir login si no autenticado.
  - `src/features/editor/Toolbar.tsx` → badge de propietario/rol, botón "Compartir".
- **Documentación**: AD-008 resuelta (auth propia JWT), ADR para permisos/colaboración, actualizar `docs/06-backend.md`, `docs/07-api.md`, `docs/08-modelo-de-datos.md`, `docs/10-roadmap.md` (Fase 4 ✅), `README.md`.
- **`.gitignore`**: sin cambios nuevos (JWT secret via env).

## Decisions

- **AD-008 resuelta aquí:** auth propia **email/password + JWT** (bcrypt + jsonwebtoken). Sin OAuth externo en esta fase (se evalúa en Fase 4.1 si hace falta). Refresh token en httpOnly cookie (seguro) + access token en memory (corto, 15 min).
- **Permisos:** `owner` (crea, borra, invita, todo), `editor` (lee, edita, guarda versiones), `viewer` (solo lee). Server valida en cada endpoint.
- **Colaboración:** por proceso (no workspace global). Invitación por email → token firmado → `POST /accept-invite` crea `ProcessCollaborator`.
- **Version history UI:** panel lateral en editor + vista dedicada; diff visual (nodos/edges añadidos/borrados/cambiados); "Restaurar" = POST nueva versión con modelo restaurado.
- **Persistencia:** SQLite (ya en Fase 3), migración incremental (`CREATE TABLE IF NOT EXISTS` idempotente).