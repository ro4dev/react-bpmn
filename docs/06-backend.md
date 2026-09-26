# 06 — Backend

> Documento: `docs/06-backend.md`

## Stack

| Herramienta | Versión | Rol |
| --- | --- | --- |
| Node.js | 25.x (requiere 20+) | Runtime |
| Express | 5.x | Framework HTTP |
| TypeScript | 6.x | Tipado estático |
| tsx | 4.x | Dev server con hot reload |
| oxlint | 1.x | Lint |
| **node:sqlite** | **nativo** | **Base de datos (Fase 3)** |
| bcrypt | 5.x | Hash de passwords (Fase 4) |
| jsonwebtoken | 9.x | Access tokens e invitaciones (Fase 4) |
| cookie-parser | 1.x | Cookie httpOnly del refresh token (Fase 4) |

## Qué hay hoy (Fase 4)

```
server/src/
├── index.ts              → Entry point: carga .env, valida JWT_SECRET, init DB + listen(PORT)
├── app.ts                → Config de Express (CORS con credentials, JSON, cookies, rutas, 404)
├── routes/
│   ├── health.ts         → GET /api/health
│   ├── auth.ts           → /api/auth (register, login, refresh, me, logout)
│   ├── processes.ts      → CRUD + versionado + colaboradores + invitaciones
│   └── invitations.ts    → /api/invitations (accept, mine)
├── middleware/
│   └── auth.ts           → authRequired / optionalAuth: valida el JWT y adjunta req.user
└── db/
    ├── schema.ts         → CREATE TABLE de las 6 tablas (idempotente)
    ├── singleton.ts      → Una sola conexión DatabaseSync por proceso
    ├── authStore.ts      → Usuarios, sesiones e invitaciones
    └── processStore.ts   → CRUD + versionado + permisos por rol
```

### Inicialización de base de datos

- El esquema se crea en el **constructor** de cada store (`initSchema` es idempotente), no en `index.ts`: así cualquier entry point — dev server, tests, scripts — tiene la base lista.
- Hay **una sola conexión** por proceso (`db/singleton.ts`). Antes cada ruta y cada middleware abrían y cerraban su propia `DatabaseSync`, lo que rompía el modo WAL y costaba I/O en cada request.
- La DB SQLite se crea en `server/data/processes.db` (configurable con `DB_PATH`; gitignored). La ruta se resuelve **contra el paquete `server/`**, no contra el CWD: `npm run dev` corre con CWD en `server/` pero `node dist/server/src/index.js` puede correrse desde la raíz, y con rutas relativas al CWD la base terminaba en `server/server/data/`.
- Motor: `node:sqlite` nativo (`DatabaseSync`) — cero dependencias, cero compilación nativa, verificado en Node 25.8.1.

### Por qué `app.ts` y `index.ts` separados

- `app.ts` exporta la app **sin** llamar a `listen()`.
- Eso permite escribir tests de integración (p. ej. con `supertest`) sin ocupar un puerto real — es lo que hace `server/test/e2e-fase4.ts`.
- `index.ts` es el único lugar con `listen()`.

### Autenticación y autorización

- `authRequired` extrae `Authorization: Bearer <token>`, lo verifica con `JWT_SECRET` y adjunta `req.user = { id, email, name }`. Sin token válido → **401**.
- Todas las rutas de `/api/processes` pasan por `authRequired`; los permisos por rol los chequea `processStore.canAccess(userId, processId, action)` con las acciones `read` / `write` / `delete` / `manage_collaborators` (ver [AD-018](./09-decisiones-de-diseno.md)).
- Un recurso al que el usuario no tiene acceso devuelve **404**, no 403: no se revela la existencia de procesos ajenos.

### Tests end-to-end

`npm --prefix server run test:e2e` compila y levanta la app contra una **DB temporal** (sin tocar `server/data/`) y ejercita el flujo completo con 40 aserciones: registro, login, refresh con rotación y reuso de token, permisos por rol, invitaciones firmadas (token alterado / email incorrecto / doble aceptación), versionado inmutable, restauración y logout.

### Import del modelo compartido

Los archivos de `server/` importan de `shared/` con rutas **relativas** (`../../../shared/src/model/types.js`), no con el alias `@shared/*`. `tsc` no reescribe los alias de `paths` en el JS emitido, así que con el alias `npm start` fallaba con `ERR_MODULE_NOT_FOUND`; el alias sigue usándose en el client, donde lo resuelve Vite.

## Estructura futura (a medida que crezcan los dominios)

```
server/src/
├── index.ts              → Entry point + init DB
├── app.ts                → Config de Express
├── routes/               → Definición de endpoints por dominio
│   ├── health.ts
│   ├── auth.ts           → Autenticación (Fase 4 ✅)
│   ├── processes.ts      → CRUD + versionado + colaboradores (Fases 3-4 ✅)
│   └── invitations.ts    → Invitaciones (Fase 4 ✅)
├── controllers/          → Handlers de los endpoints (usan services)
├── services/             → Lógica de negocio (no sabe de HTTP)
├── models/               → Capa de datos / persistencia (Fase 3: ver `db/`)
└── middleware/           → Validación, manejo de errores, auth (Fase 4 ✅)
```

## Convenciones

- **ESM puro**: `"type": "module"` en `package.json`; imports relativos con extensión `.js` (p. ej. `import { app } from "./app.js"`), que tsx resuelve a `.ts` en dev y Node a `.js` en el build.
- **Montar rutas bajo `/api/<dominio>`** en `app.ts`.
- Respuestas JSON consistentes: `{ "error": "..." }` para errores, recursos directos para éxito (ver [07 — API](./07-api.md)).
- Tipos del dominio compartidos con el frontend vía `shared/` (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).

## Variables de entorno

Se leen de `server/.env` (parser propio, sin dependencias; no sobreescribe variables ya presentes en el entorno).

| Variable | Default | Descripción |
| --- | --- | --- |
| `JWT_SECRET` | — | **Obligatoria.** Firma los access tokens y las invitaciones. Sin ella el server no arranca. |
| `PORT` | `4000` | Puerto de la API |
| `DB_PATH` | `data/processes.db` | Ruta del archivo SQLite, relativa al paquete `server/` (o absoluta) |

Generar un secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copia `server/.env.example` a `server/.env` (gitignored) y completá los valores.

## Cómo agregar una ruta nueva (receta)

1. Crear `src/routes/<dominio>.ts` con un `Router` de Express.
2. Exportar el router y montarlo en `app.ts`: `app.use("/api/<dominio>", router)`.
3. Documentar el endpoint en [07 — API](./07-api.md).
4. Correr `npm run lint` y `npm run typecheck` desde `server/`.