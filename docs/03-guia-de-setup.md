# 03 — Guía de setup

> Documento: `docs/03-guia-de-setup.md`

## Requisitos

| Requisito | Versión |
| --- | --- |
| Node.js | 20+ (probado con **v25.8.1**) |
| npm | 10+ (probado con **11.11.0**) |

Verificar:

```bash
node -v
npm -v
```

## Instalación (primera vez)

Desde la raíz del repo:

```bash
npm install                # dependencias de scripting (concurrently)
npm install --prefix client
npm install --prefix server
```

### Configurar el server (Fase 4)

La API necesita un secreto para firmar los JWT. **Sin esto no arranca**:

```bash
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# → pegá el valor en JWT_SECRET= dentro de server/.env
```

`server/.env` está en `.gitignore`: nunca subas el secreto real.

## Comandos

Todos los comandos se corren **desde la raíz del repo**, salvo indicación contraria.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta **server y client juntos** (concurrently) |
| `npm run dev:server` | Levanta solo la API (hot reload con `tsx watch`, puerto 4000) |
| `npm run dev:client` | Levanta solo el frontend (Vite, puerto 5173) |
| `npm run seed` | Crea los datos de prueba (2 usuarios, 2 procesos, invitación) |
| `npm run build` | Compila server y client a producción |
| `npm run lint` | Lint de server y client (oxlint) |
| `npm test` | Tests completos: store (server), seed, e2e de la API y diff semántico (client) |
| `npm run typecheck` | Typecheck de server (`tsc --noEmit`) + build del client |

### Comandos por aplicación

```bash
# Desde client/
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run test       # tests del diff semántico (node:test, sin dependencias)
npm run preview    # sirve el build anterior

# Desde server/
npm run dev        # tsx watch src/index.ts
npm run build      # tsc → dist/
npm run start      # node dist/server/src/index.js
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
npm run test       # build + test:unit + test:seed + test:e2e
npm run test:unit  # tests del ProcessStore (autoría, caché de roles, N+1)
npm run test:seed  # tests del seed de datos demo (idempotencia, modelos válidos)
npm run test:e2e   # tests end-to-end de la API (Fase 4, DB temporal)
npm run seed       # crea los datos de prueba en la DB de dev
```

## Datos de prueba

`npm run seed` siembra la base de dev con lo justo para recorrer la app sin
registrar nada a mano:

| Email | Contraseña | Rol | Qué sirve para ver |
| --- | --- | --- | --- |
| `ana@demo.local` | `demo1234` | owner de los 2 | Collaboration (invitar, quitar), badge de owner, botón Compartir |
| `bruno@demo.local` | `demo1234` | editor de uno, viewer del otro | Editar uno, solo lectura en el otro, badge de rol |

"Pedido de compra" tiene 3 versiones guardadas por Ana y Bruno (se ve el autor
en el historial) y una invitación viva a `pendiente@ejemplo.local`, para ver cómo
se ve una invitación que todavía no fue aceptada. En `/login` hay dos botones
que rellenan el formulario con esas cuentas: es el login normal con credenciales
conocidas, **no** un bypass de la autenticación.

El seed es **idempotente**: si `ana@demo.local` ya existe no hace nada, así que
podés correrlo las veces que quieras sin duplicar datos.

> `start` apunta a `dist/server/src/index.js`: el `tsconfig` del server usa `rootDir: ".."` para compilar también `shared/`, así que la salida queda anidada un nivel más.

## Verificar que todo anda

1. Levantar todo: `npm run dev`
2. Frontend → abrir `http://localhost:5173` (debería verse el placeholder del modelador).
3. API → `curl http://localhost:4000/api/health` debe responder:

```json
{ "status": "ok", "timestamp": "2026-09-23T00:58:35.938Z" }
```

4. Crear el primer usuario: abrí `http://localhost:5173/register` (la app redirige a `/login` si no hay sesión).

## Variables de entorno

| Variable | Dónde | Default | Uso |
| --- | --- | --- | --- |
| `JWT_SECRET` | `server/.env` (ver `server/.env.example`) | — | **Obligatoria.** Firma access tokens e invitaciones. El server no arranca sin ella. |
| `PORT` | `server/.env` | `4000` | Puerto de la API |
| `DB_PATH` | `server/.env` | `data/processes.db` | Ruta del archivo SQLite (relativa al paquete `server/`) |

Aparte de `JWT_SECRET`, todo funciona con los defaults.

## Solución de problemas frecuentes

- **"JWT_SECRET no configurado"** → creaste `server/.env.example` pero no `server/.env`, o le falta la línea. Ver [Configurar el server](#configurar-el-server-fase-4).
- **El server arranca pero toda la API devuelve 401** → el access token expiró (duran 15 min); el cliente lo renueva solo. Si estás probando con `curl`, mandá `Authorization: Bearer <accessToken>`.
- **"El proceso no encontrado" con un ID que existe** → el usuario no es owner ni colaborador. Cada usuario solo ve lo suyo (ver [AD-018](./09-decisiones-de-diseno.md)).
- **El puerto 4000 está ocupado** → cerrá el proceso o definí `PORT` en `server/.env` (y ajustá el proxy en `client/vite.config.ts`).
- **El client no llega a la API** → verificar que el server esté corriendo y que la llamada sea a `/api/*` (el proxy solo reenvía esas rutas).
- **`npm start` falla con `ERR_MODULE_NOT_FOUND` en un archivo de `shared/`** → rebuild del server: `npm --prefix server run build`. Los imports del modelo compartido se resuelven en runtime desde el JS emitido.