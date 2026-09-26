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
│   ├── auth.ts           → authRequired / optionalAuth: valida el JWT y adjunta req.user
│   └── roleCache.ts      → Abre la caché de roles del request
└── db/
    ├── schema.ts         → CREATE TABLE de las 6 tablas (idempotente) + migraciones
    ├── singleton.ts      → Una sola conexión DatabaseSync por proceso
    ├── roleCache.ts      → Caché de roles por request (AsyncLocalStorage)
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

### Caché de roles y consultas del listado

- `roleOf(userId, processId)` se llama varias veces por request (una ruta hace `getMeta` → `canAccess` → `roleOf`, y después `listVersions` → `canAccess` → `roleOf` otra vez). El middleware `roleCache` abre un scope con `AsyncLocalStorage` (`db/roleCache.ts`) y memoiza el resultado **por request**: no es un `Map` en el store, porque una caché global serviría permisos viejos si un owner cambia el rol de alguien a mitad de vuelo. Fuera de un request (tests, scripts) no hay caché. Toda mutación de roles (`addCollaborator`, `addCollaboratorDirect`, `removeCollaborator`, `delete`) invalida el scope, así que un request que acepta una invitación y después chequea permisos ve el rol nuevo.
- `list()` resuelve **una sola sentencia**: el rol del solicitante sale de un `LEFT JOIN` a `ProcessCollaborator` (con `CASE` para que el owner gane siempre) y el `versionCount` y el modelo de la última versión, de subconsultas correlacionadas. Antes eran 1 + 3N consultas. `server/test/store-unit.ts` mide esto con el authorizer de SQLite comparando el conteo con 2 procesos contra el de 20.

### Autoría de las versiones

Cada `POST`/`PUT` (y también `restore`) manda `authorName` desde `req.user`; el store lo persiste junto al `authorId`. Si no viene, lo resuelve consultando `User` para no dejar la versión con `authorId` pero sin nombre. Ver [docs/08](08-modelo-de-datos.md#entidades-de-persistencia-✅-implementadas-fase-3--4).

### Tests

- `npm --prefix server run test:unit` — 18 aserciones sobre el `ProcessStore` con DB temporal: autoría (incluido el fallback a `User`), semántica de la caché de roles dentro de un mismo scope (que una mutación no deje el valor viejo) y conteo de sentencias para la regresión del N+1.
- `npm --prefix server run test:seed` — 52 aserciones sobre `db/seed.ts` y el catálogo: que la contraseña demo autentique de verdad, que **todas** las versiones de los 100 procesos pasen `validateProcess` (si no, el editor abriría el proceso con errores), que el historial vaya para adelante (dos versiones seguidas nunca son el mismo modelo, así el diff siempre muestra algo), que quien firma una versión pueda guardar de verdad, que el seed sea idempotente y que `--reset` borre solo los datos demo sin tocar los de otros usuarios.
- `npm --prefix server run test:e2e` — 47 aserciones de integración contra la app real.
- `npm --prefix client run test` — 12 aserciones del diff semántico de grafo (`client/test/model-diff.test.ts`), sin dependencias: `node:test` + `--experimental-strip-types`.
- `npm test` (raíz) corre las cuatro.

### Datos de prueba

`npm run seed` (`src/seed.ts` → `db/seed.ts`) siembra la base de dev con dos
usuarios conocidos (`ana@demo.local`, `bruno@demo.local`, contraseña `demo1234`),
**100 procesos de negocio** y una invitación viva a `pendiente@ejemplo.local`.

Los procesos no están escritos a mano uno por uno: viven en un catálogo
(`db/demoProcesses.ts`) con el nombre, los pasos y las decisiones de cada proceso
—de 12 áreas: personas, contratación, compras, inventario, ventas, logística,
servicio al cliente, calidad, finanzas, legal, tecnología y salud— y un
constructor arma el grafo según la **forma** que declara cada entrada (`lineal`,
`revision`, `aprobacion`, `paralelo`, `compuesto`). Así todos los modelos salen
válidos por construcción y ninguno se llama "Proceso 37".

El historial también sale del catálogo: cada proceso tiene 2-4 versiones que van
de la forma más simple a la que declara, con los pasos creciendo y las decisiones
sumándose, firmadas por Ana y Bruno turnando. Los colaboradores se agregan
**antes** que las versiones, porque quien firma una versión tiene que poder
guardar de verdad.

Es **idempotente por diseño**: si `ana@demo.local` ya existe no hace nada, así que
se puede correr cada vez que uno arranca sin pisar el trabajo real ni duplicar
datos. `npm run seed:reset` borra solo los datos demo (por SQL, no borrando el
archivo, así el server corriendo lo ve al instante) y vuelve a sembrar. La carga
de `.env` vive en `config/env.ts` (no en `index.ts`) para que el seed tenga
`JWT_SECRET` —lo necesita para firmar la invitación— sin duplicar el parser.

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
├── middleware/           → Validación, manejo de errores, auth (Fase 4 ✅)
├── config/env.ts         → Lectura de .env (la usan index.ts y el seed)
├── seed.ts               → CLI de `npm run seed` (admite --reset)
└── db/                   → SQLite: schema, stores, caché de roles, seed
    ├── schema.ts         → DDL idempotente
    ├── processStore.ts   → Procesos, versiones, colaboradores
    ├── authStore.ts      → Usuarios, tokens e invitaciones
    ├── roleCache.ts      → Caché de roles por request (AsyncLocalStorage)
    ├── demoProcesses.ts  → Catálogo de los 100 procesos demo + constructor de grafos
    ├── seed.ts           → Datos demo (idempotente) e historial por proceso
    └── singleton.ts      → Instancias compartidas + resolución de DB_PATH
```

## Convenciones

- **ESM puro**: `"type": "module"` en `package.json`; imports relativos con extensión `.js` (p. ej. `import { app } from "./app.js"`), que tsx resuelve a `.ts` en dev y Node a `.js` en el build.
- **Montar rutas bajo `/api/<dominio>`** en `app.ts`.
- Respuestas JSON consistentes: `{ "error": "..." }` para errores, recursos directos para éxito (ver [07 — API](./07-api.md)).
- Tipos del dominio compartidos con el frontend vía `shared/` (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).

## Variables de entorno

Se leen de `server/.env` con el parser de `config/env.ts` (propio, sin dependencias; no sobreescribe variables ya presentes en el entorno).

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