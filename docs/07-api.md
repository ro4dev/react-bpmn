# 07 — API

> Documento: `docs/07-api.md`
>
> Documenta los endpoints de la API. Todo lo que no dice **"✅ implementado"** es planeado.

## Base URL

- Desarrollo: `http://localhost:4000` (el client la llama via proxy como `/api/*`)
- Prefijo común: `/api`

## Health check

### `GET /api/health` ✅ implementado

Estado de la API.

**Respuesta 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-09-23T00:58:35.938Z"
}
```

---

## Procesos (✅ implementado Fase 3 + 4)

Recurso: `/api/processes`. **Todas las rutas requieren autenticación** (`Authorization: Bearer <accessToken>`) y devuelven **401** sin token válido.

| Método | Ruta | Rol mínimo | Descripción | Estado |
| --- | --- | --- | --- | :-: |
| `GET` | `/api/processes` | viewer | Lista los procesos donde el usuario es owner o colaborador | ✅ |
| `GET` | `/api/processes?q=&scope=` | viewer | `q` filtra por nombre; `scope=mine` solo los propios | ✅ |
| `GET` | `/api/processes/:id` | viewer | Detalle de un proceso con el modelo de su última versión | ✅ |
| `POST` | `/api/processes` | — | Crea un proceso + versión 1; el creador queda `owner` | ✅ |
| `PUT` | `/api/processes/:id` | editor | Actualiza → crea versión N+1 (no sobrescribe) | ✅ |
| `DELETE` | `/api/processes/:id` | owner | Elimina proceso (cascada a versiones e invitaciones) | ✅ |

Los errores de permiso son **403** `{ "error": "..." }`. Un proceso al que el usuario no tiene acceso devuelve **404** (no 403: no se revela la existencia de recursos ajenos).

### Versionado

| Método | Ruta | Rol mínimo | Descripción | Estado |
| --- | --- | --- | --- | :-: |
| `GET` | `/api/processes/:id/versions` | viewer | Lista metadatos de versiones (DESC) | ✅ |
| `GET` | `/api/processes/:id/versions/:v` | viewer | Modelo completo de una versión | ✅ |
| `POST` | `/api/processes/:id/versions/:v/restore` | editor | Restaura una versión creando la N+1 | ✅ |

`restore` **no borra nada**: inserta una versión nueva con el modelo de la `:v` y el comentario `Restaurado desde vN` (ver [AD-020](09-decisiones-de-diseno.md#ad-020-timeline-de-versiones-en-la-ui)).

### Colaboradores e invitaciones

| Método | Ruta | Rol mínimo | Descripción | Estado |
| --- | --- | --- | --- | :-: |
| `GET` | `/api/processes/:id/collaborators` | viewer | Colaboradores + invitaciones pendientes + `canManage` | ✅ |
| `POST` | `/api/processes/:id/collaborators` | owner | Invita por email con rol `editor` o `viewer` | ✅ |
| `DELETE` | `/api/processes/:id/collaborators/:userId` | owner | Quita a un colaborador | ✅ |
| `DELETE` | `/api/processes/:id/invitations/:invitationId` | owner | Cancela una invitación pendiente | ✅ |

**POST /api/processes/:id/collaborators** (request): `{ "email": "…", "role": "editor" | "viewer" }`

La respuesta cambia según el email:

- Si el usuario **ya está registrado** → `{ "kind": "collaborator", "collaborator": {…} }` y el acceso queda activo de una.
- Si **no existe** → `{ "kind": "invitation", "invitation": { "id", "email", "processId", "role", "token", "expiresAt", "createdAt" } }` (token firmado, 7 días). El link es `/invitaciones?token=…`; sin SMTP, el server lo loguea en consola y la UI lo muestra para copiar.

Rechaza con **400** invitarse a uno mismo o al owner, y con **400** si el email no tiene formato válido.

**GET /api/processes/:id/collaborators** (response):

```json
{
  "collaborators": [
    { "userId": "uuid", "email": "ana@ejemplo.com", "name": "Ana", "role": "owner", "invitedAt": "…" }
  ],
  "invitations": [
    { "id": "uuid", "email": "carla@ejemplo.com", "role": "viewer", "expiresAt": "…", "createdAt": "…" }
  ],
  "canManage": true
}
```

### Payload de proceso (request/response)

**POST /api/processes** / **PUT /api/processes/:id** (request body):

```json
{
  "name": "Mi proceso",
  "model": { "version": 1, "nodes": [...], "edges": [...] },
  "comment": "Versión inicial"
}
```

**GET /api/processes** (response item - metadatos):

```json
{
  "id": "uuid-v4",
  "name": "Mi proceso",
  "currentVersion": 3,
  "ownerId": "uuid-v4",
  "createdAt": "2026-09-24T10:00:00.000Z",
  "updatedAt": "2026-09-24T12:30:00.000Z",
  "versionCount": 3,
  "preview": "5 nodos, 4 aristas",
  "status": "válido",
  "role": "owner"
}
```

`role` es el rol del **usuario solicitante** sobre ese proceso (`owner` | `editor` | `viewer`); la UI lo usa para el badge y para habilitar o deshabilitar acciones.

**GET /api/processes/:id** (response - completo): los mismos metadatos más `"model": { "version": 1, "nodes": [...], "edges": [...] }`.

**GET /api/processes/:id/versions** (response item):

```json
{
  "version": 3,
  "comment": "Ajuste decisión",
  "createdAt": "2026-09-24T12:30:00.000Z"
}
```

### Validación server-side

- `POST` y `PUT` validan el `model` con `validateProcess` compartido (`shared/src/validation/validateProcess`).
- Si hay errores (`severity: "error"`): **400** `{ "error": "Modelo inválido", "issues": [...] }`.
- Si no existe o el usuario no tiene acceso: **404** `{ "error": "Proceso no encontrado" }`.
- Sin permiso suficiente: **403** `{ "error": "Permiso insuficiente" }`.

---

## Autenticación (✅ implementado Fase 4)

Recurso: `/api/auth`. Único recurso **público** de la API (junto con `/api/health`).

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | :-: |
| `POST` | `/api/auth/register` | Crea usuario y devuelve sesión | ✅ |
| `POST` | `/api/auth/login` | Login, devuelve sesión | ✅ |
| `POST` | `/api/auth/refresh` | Rota el refresh token de la cookie y emite un access token nuevo | ✅ |
| `GET` | `/api/auth/me` | Usuario del access token (leído de la DB) | ✅ |
| `PUT` | `/api/auth/me` | Actualiza `name` / `avatar` | ✅ |
| `POST` | `/api/auth/logout` | Revoca el refresh token de la cookie | ✅ |

**register / login** (request): `{ "email": "…", "password": "…", "name": "…" }` (login no usa `name`).

**register / login** (response `201` / `200`):

```json
{
  "user": { "id": "uuid", "email": "ana@ejemplo.com", "name": "Ana", "avatar": null, "createdAt": "…" },
  "accessToken": "eyJ…"
}
```

Además, ambas respuestas setean la **cookie httpOnly `refreshToken`** (`7 días`, `sameSite=lax`, `secure` con `NODE_ENV=production`); el access token viaja solo en el body.

Códigos de error: **409** email ya registrado, **401** credenciales inválidas, **400** datos inválidos (`{ "error": "Datos inválidos", "issues": [...] }`).

**POST /api/auth/refresh** (response): `{ "accessToken": "eyJ…" }` + cookie renovada. **401** si no hay cookie, si expiró o si el token ya fue rotado.

---

## Invitaciones (✅ implementado Fase 4)

Recurso: `/api/invitations`.

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | :-: |
| `POST` | `/api/invitations/accept` | Acepta una invitación con su token | ✅ |
| `GET` | `/api/invitations/mine` | Invitaciones pendientes del email del usuario | ✅ |

**POST /api/invitations/accept** (request): `{ "token": "eyJ…" }` → `{ "collaborator": { "processId", "userId", "role", "invitedAt" } }`.

Errores: **400** token inválido, expirado, adulterado o ya usado; **403** si la sesión no es del email invitado.

**GET /api/invitations/mine** (response item):

```json
{
  "id": "uuid",
  "email": "carla@ejemplo.com",
  "processId": "uuid",
  "processName": "Pedido de compra",
  "role": "viewer",
  "token": "eyJ…",
  "expiresAt": "…",
  "createdAt": "…",
  "alreadyAccepted": false
}
```

El `token` viaja en la respuesta a propósito: el usuario ya está autenticado **con ese email**, así que puede aceptar su propia invitación sin que haya que mandársela por correo.

---

## Convenciones de la API

- **JSON** en todo request/response.
- **Autenticación**: header `Authorization: Bearer <accessToken>` (ver [AD-017](09-decisiones-de-diseno.md#ad-017-autenticacion-propia-emailpassword--jwt)). El access token expira a los 15 min; el cliente lo renueva solo ante un **401** con la cookie de refresh.
- **Errores**: `{ "error": "<mensaje>" }` con el código HTTP correspondiente (400 validación, 401 sin sesión, 403 sin permiso, 404 no existe o sin acceso, 409 conflicto).
- **IDs**: UUID v4 generado por el server.
- **Fechas**: ISO 8601 en UTC.
- **Roles**: `owner` > `editor` > `viewer`, chequeados siempre en el server (ver [AD-018](09-decisiones-de-diseno.md#ad-018-autorizacion-por-proceso-ownereditorviewer)).
- CORS habilitado para desarrollo, con `credentials: true` (necesario para la cookie de refresh).