# Design

## Context

La Fase 3 entregó persistencia real (SQLite, CRUD, versionado) pero **sin usuarios ni control de acceso**: cualquier request anónima puede crear/leer/borrar procesos. La Fase 4 agrega **autenticación, autorización, compartir y timeline de versiones**. Tres decisiones atraviesan todo: el **método de auth** (AD-008, abierta), el **modelo de permisos** (por proceso vs workspace) y la **UI del historial** (panel lateral vs vista dedicada).

## Goals / Non-Goals

**Goals:**

- Autenticación propia: registro, login, JWT (access + refresh), logout, perfil.
- Autorización por proceso: dueño (`owner`), editor, viewer — validado en server en cada operación.
- Compartir procesos: invitar por email/rol, aceptar invitación, listar/quitar colaboradores.
- Timeline de versiones en la UI: listado visual, diff, restaurar versión anterior.
- Header global con avatar, menú usuario, logout; rutas protegidas en el client.

**Non-Goals:**

- OAuth (Google/GitHub/etc.) — se evalúa en Fase 4.1 si hay demanda real.
- Workspaces/equipos globales — el modelo es "por proceso" (más simple y flexible).
- Notificaciones push/email — solo invitación por token (el email real se simula con log en consola).
- Auditoría completa (who/when/what) — solo versiones + colaboradores; auditoría fina en Fase 5 si hace falta.
- 2FA / MFA — fuera de alcance por ahora.

## Capabilities

### Nueva capability: `autenticacion-usuarios`

#### Requirement: Registro de usuario

El server SHALL registrar un usuario con email único, password hasheado (bcrypt), nombre y avatar opcional, y devolver access token (15 min) + refresh token (httpOnly cookie, 7 días).

##### Scenario: Registrar usuario nuevo

- **WHEN** el client envía `POST /api/auth/register` con `{ email, password, name }`
- **THEN** el server responde `201` con `{ user: { id, email, name, avatar?, createdAt }, accessToken }`
- **AND** setea cookie httpOnly `refreshToken`
- **AND** el email no existe previamente

##### Scenario: Email duplicado

- **WHEN** el client envía `POST /api/auth/register` con un email ya registrado
- **THEN** el server responde `409` con `{ error: "Email ya registrado" }`

#### Requirement: Login

El server SHALL validar credenciales y devolver access token + refresh token cookie.

##### Scenario: Login exitoso

- **WHEN** el client envía `POST /api/auth/login` con `{ email, password }`
- **THEN** el server responde `200` con `{ user, accessToken }` + cookie `refreshToken`

##### Scenario: Credenciales inválidas

- **WHEN** el client envía `POST /api/auth/login` con password incorrecto
- **THEN** el server responde `401` con `{ error: "Credenciales inválidas" }`

#### Requirement: Refresh token

El server SHALL emitir nuevo access token a partir de refresh token válido (rotación opcional en Fase 4.1).

##### Scenario: Access token expirado, refresh válido

- **WHEN** el client envía `POST /api/auth/refresh` con cookie `refreshToken`
- **THEN** el server responde `200` con `{ accessToken }` (nuevo)
- **AND** opcionalmente rota el refresh token

#### Requirement: Perfil de usuario

El server SHALL permitir obtener y actualizar el perfil del usuario autenticado.

##### Scenario: Obtener perfil

- **WHEN** el client hace `GET /api/auth/me` con access token válido
- **THEN** el server responde `200` con `{ id, email, name, avatar?, createdAt }`

##### Scenario: Actualizar perfil

- **WHEN** el client envía `PUT /api/auth/me` con `{ name?, avatar? }`
- **THEN** el server responde `200` con perfil actualizado

---

### Nueva capability: `autorizacion-procesos`

#### Requirement: Owner automático al crear proceso

Al crear un proceso (`POST /api/processes`), el server SHALL asignar `ownerId = req.user.id` y crear entrada en `ProcessCollaborator` con rol `owner`.

##### Scenario: Crear proceso autenticado

- **WHEN** usuario autenticado envía `POST /api/processes` con modelo válido
- **THEN** el server responde `201` con proceso que incluye `ownerId` del usuario
- **AND** existe `ProcessCollaborator` con `role: "owner"` para ese usuario-proceso

#### Requirement: Validar permisos en cada operación

El server SHALL rechazar con `403` si el usuario no tiene permiso para la operación solicitada.

| Operación | owner | editor | viewer | sin acceso |
|-----------|-------|--------|--------|------------|
| GET /:id | ✅ | ✅ | ✅ | ❌ |
| PUT /:id (guardar versión) | ✅ | ✅ | ❌ | ❌ |
| DELETE /:id | ✅ | ❌ | ❌ | ❌ |
| POST /:id/collaborators | ✅ | ❌ | ❌ | ❌ |
| GET /:id/versions | ✅ | ✅ | ✅ | ❌ |
| GET /:id/versions/:v | ✅ | ✅ | ✅ | ❌ |

##### Scenario: Acceso denegado

- **WHEN** usuario sin permiso intenta `PUT /api/processes/:id`
- **THEN** el server responde `403` con `{ error: "Permiso insuficiente" }`

#### Requirement: Invitar colaborador

El server SHALL permitir al owner invitar a otro usuario por email con rol `editor` o `viewer`.

##### Scenario: Invitar colaborador válido

- **WHEN** owner envía `POST /api/processes/:id/collaborators` con `{ email, role: "editor" }`
- **THEN** el server responde `201` con `{ collaborator: { processId, userId, role, invitedAt } }`
- **AND** si el usuario ya existe → crea `ProcessCollaborator` directo
- **AND** si no existe → crea `Invitation` con token firmado (expira 7 días) y loggea "email simulado" en consola

#### Requirement: Aceptar invitación

El server SHALL permitir aceptar una invitación vía token.

##### Scenario: Aceptar invitación válida

- **WHEN** usuario (registrado o nuevo) hace `POST /api/invitations/accept` con `{ token }`
- **THEN** el server responde `200` con `{ collaborator }` y crea `ProcessCollaborator`
- **AND** invalida la invitación (uso único)

---

### Nueva capability: `historial-versiones-ui`

#### Requirement: Listar versiones con diff

El client SHALL mostrar un panel/vista con todas las versiones de un proceso, permitiendo ver diff visual y restaurar.

##### Scenario: Abrir historial de versiones

- **WHEN** el usuario clickea "Historial" en la toolbar
- **THEN** se abre `VersionHistory` panel lateral con lista de versiones (vN, comment, fecha, autor)
- **THEN** al clickear una versión → muestra diff visual (nodos/edges añadidos/borrados/cambiados)

##### Scenario: Restaurar versión anterior

- **WHEN** el usuario clickea "Restaurar esta versión" en vK
- **THEN** el client envía `POST /api/processes/:id` con `model` = modelo de vK y `comment: "Restaurado desde vK"`
- **THEN** el server crea versión N+1 con ese modelo → el editor actualiza a vN+1

---

## Decisions

### D1 — Auth propia: email/password + JWT (resuelve AD-008)

**Contexto:** AD-008 estaba **abierta** ("¿solo modelar o también ejecutar? / ¿autenticación?"). La Fase 3 no la resolvió. Opciones: auth propia (control total, más código), OAuth (delegado, depende de terceros), magic links (UX buena, requiere email real). Para un editor interno de organización, auth propia es la más simple y controlada.

**Decisión:** ✅ **Adoptada (Fase 4):** **email/password + bcrypt + JWT**.
- Access token: 15 min, JWT firmado (HS256), payload `{ sub: userId, email, name, iat, exp }`.
- Refresh token: 7 días, guardado en DB (hash) + cookie httpOnly secure sameSite=lax.
- Secret JWT via env `JWT_SECRET` (generado en setup).
- Logout = borrar refresh token de DB + limpiar cookie.

**Consecuencias:** cero dependencia de proveedores externos; control total de sesión; requiere gestión de secretos y rotación (documentada). Refresh token en cookie httpOnly previene XSS; access token en memory (no localStorage) previene robo vía XSS.

### D2 — Permisos por proceso (no workspace)

**Contexto:** modelo de permisos: workspace global (como Notion/GitHub) vs por recurso (como Google Docs/Figma). El editor de procesos es granular (un proceso = un documento), y la Fase 3 ya versiona por proceso.

**Decisión:** ✅ **Adoptada:** permisos **por proceso** (`ProcessCollaborator` con `processId, userId, role`). `owner` implícito al crear. Sin workspaces, equipos ni organizaciones en esta fase.

**Consecuencias:** más granular, más simple de implementar (una tabla). Si en Fase 5 hace falta "equipos", se añade capa encima sin romper lo actual.

### D3 — Invitación por token firmado (sin email real)

**Contexto:** enviar email real requiere SMTP/servicio (SendGrid, Resend, etc.) — infra extra. Para Fase 4 MVP, simulamos el email loggeando el link en consola del server.

**Decisión:** ✅ **Adoptada:** `Invitation` table con `token` (JWT firmado, expira 7 días, payload `{ email, processId, role, exp }`). `POST /api/invitations/accept` valida token y crea `ProcessCollaborator`. Consola: `"[invite] Link para <email>: /accept?token=..."`.

**Consecuencias:** cero infra de email; testeable manualmente; migración a email real = solo añadir envío en `POST /collaborators` sin cambiar schema.

### D4 — Timeline de versiones: panel lateral + diff visual

**Contexto:** el server ya guarda `ProcessVersion` (Fase 3). La UI puede ser panel lateral en editor o vista dedicada. El diff visual requiere comparar dos `ProcessModel` (nodos/edges).

**Decisión:** ✅ **Adoptada:** panel lateral derecho en editor (`VersionHistory`), lista versiones DESC, click = diff visual, botón "Restaurar" = crea nueva versión con modelo restaurado. Diff: compara `nodes` (por id: added/removed/changed label/position/props) y `edges` (added/removed/changed source/target/label).

**Consecuencias:** reutiliza `ProcessModel` + `serialize.ts` (diff puro, sin React Flow); "Restaurar" es un `PUT` normal que crea versión N+1 (consistente con versionado inmutable).

---

## Risks / Trade-offs

- [JWT secret management] → Mitigado: `JWT_SECRET` en `.env` (no commiteado), docs en setup. Rotación manual documentada.
- [bcrypt sync bloquea event loop] → Aceptado: registro/login son raros; si escala, mover a worker thread o `bcryptjs` (async).
- [Invitación sin email real] → Limitación conocida; migración a email real = solo añadir `nodemailer`/`resend` en `POST /collaborators` sin cambiar contrato.
- [Permisos por proceso escalan mal si hay miles] → Aceptado por ahora; Fase 5 evalúa workspaces si hace falta.
- [Diff visual puede ser costoso para modelos grandes] → Aceptado: modelos típicos < 100 nodos; algoritmo O(n) por id.
- [Concurrencia en SQLite con auth] → `DatabaseSync` síncrono + WAL mode (PRAGMA journal_mode=WAL) habilitado en schema.

---

## Migration Plan

1. **Migración DB idempotente** (`schema.ts`): `CREATE TABLE IF NOT EXISTS User`, `ProcessCollaborator`, `Invitation` + FKs + índices. `Process` añade `ownerId` (nullable para compat, luego NOT NULL tras backfill).
2. **Backfill `ownerId`** en procesos existentes: asignar al primer usuario admin o dejar NULL (legacy, solo lectura).
3. **JWT secret**: generar en `server/.env.example` (`JWT_SECRET=...`); documentar en setup.
4. **Client**: limpiar localStorage de procesos "huérfanos" (sin owner) o migrarlos si hay usuario logueado.

No hay datos de usuarios previos (Fase 3 no tenía auth). El primer usuario que se registre será el primer owner.

---

## Open Questions

- **¿OAuth en Fase 4.1?** Si hay demanda real de "login con Google/GitHub", se añade estrategia Passport.js o similar sin romper JWT actual.
- **¿Workspaces/equipos en Fase 5?** Si la organización pide "todos los procesos de mi equipo", se añade `Team` + `TeamMember` encima del modelo actual.
- **¿Auditoría fina?** Si hace falta log de "quién cambió qué campo", se añade tabla `AuditLog` (userId, processId, action, diff, timestamp) en Fase 5.
- **¿2FA/MFA?** Fuera de alcance por ahora; se evalúa si hay requisito de seguridad corporativo.