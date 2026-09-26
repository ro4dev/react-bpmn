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
| `npm run seed` | Crea los datos de prueba (2 usuarios, 100 procesos, invitación) |
| `npm run seed:reset` | Borra solo los datos demo y los vuelve a sembrar |
| `npm run build` | Compila server y client a producción |
| `npm run lint` | Lint de server y client (oxlint) |
| `npm test` | Tests completos: store (server), seed, e2e de la API, diff semántico y **browser** |
| `npm run test:ui` | Solo los tests de browser (Playwright); siembra la base temporal antes de levantar los servidores |
| `npm run typecheck` | Typecheck de server (`tsc --noEmit`) + build del client |

### Comandos por aplicación

```bash
# Desde client/
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run test       # tests del diff semántico (node:test, sin dependencias)
npm run test:ui    # tests de browser con Playwright (Chrome del sistema)
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
npm run seed:reset # borra solo los datos demo y los vuelve a sembrar
```

## Datos de prueba

`npm run seed` siembra la base de dev con **100 procesos de negocio** y dos
usuarios conocidos, para recorrer la app sin registrar nada a mano:

| Email | Contraseña | Rol | Qué sirve para ver |
| --- | --- | --- | --- |
| `ana@demo.local` | `demo1234` | owner de 95 | Collaboration (invitar, quitar), badge de owner, botón Compartir |
| `bruno@demo.local` | `demo1234` | editor de 32, viewer de 1, owner de 5 | Editar algunos, solo lectura en otro, badge de rol |

### Los 100 procesos

No son 100 archivos: son un **catálogo** (`server/src/db/demoProcesses.ts`) con
el nombre, los pasos y las decisiones de cada proceso de negocio, en 12 áreas:

| Área | | Área | | Área | |
| --- | --- | --- | --- | --- | --- |
| Personas | 12 | Compras | 13 | Calidad | 6 |
| Contratación | 9 | Inventario | 11 | Finanzas | 8 |
| Ventas | 12 | Logística | 8 | Legal | 5 |
| Servicio al cliente | 8 | | | Tecnología | 5 |
| | | | | Salud | 3 |

Cada entrada declara sus pasos y su **forma**, y un constructor arma el grafo:

| Forma | Qué agrega | Cuántos nodos |
| --- | --- | --- |
| `lineal` | Inicio → pasos → Fin | 5-8 |
| `revision` | un camino "no" que corrige y vuelve al primer paso | 7-9 |
| `aprobacion` | cadena de decisiones, cada "no" devuelve el expediente | 8-10 |
| `paralelo` | un "sí" abre ramas que vuelven a converger | 10-11 |
| `compuesto` | fases, paralelismo, correcciones y escalamiento | 16 |

El reparto real: 51 procesos simples (menos de 8 nodos) y 31 enrevesados (10
nodos o más), así se ven los dos extremos. Todos los modelos pasan
`validateProcess`: el editor nunca abre un proceso del catálogo con errores.

El historial también es real: cada proceso tiene 2-4 versiones que van de la más
simple a su forma final, firmadas por Ana y Bruno turnando, con comentarios que
dicen qué se agregó. Ninguna versión repite la anterior, así que el diff del
historial siempre tiene algo que mostrar.

"Pedido de compra" tiene 3 versiones guardadas por Ana y Bruno (se ve el autor
en el historial) y una invitación viva a `pendiente@ejemplo.local`, para ver cómo
se ve una invitación que todavía no fue aceptada. En `/login` hay dos botones
que rellenan el formulario con esas cuentas: es el login normal con credenciales
conocidas, **no** un bypass de la autenticación.

El seed es **idempotente**: si `ana@demo.local` ya existe no hace nada, así que
podés correrlo las veces que quieras sin duplicar datos.

Si querés regenerar el catálogo (por ejemplo después de cambiarlo), usá
`npm run seed:reset`: borra **solo** los datos demo —sus procesos, versiones,
colaboradores, invitaciones y sesiones— y vuelve a sembrar. No borra el archivo
de la base, así que el server que tengas corriendo lo ve al instante, y no toca
los datos de ningún otro usuario.

> `start` apunta a `dist/server/src/index.js`: el `tsconfig` del server usa `rootDir: ".."` para compilar también `shared/`, así que la salida queda anidada un nivel más.

## Verificar que todo anda

1. Levantar todo: `npm run dev`
2. Frontend → abrir `http://localhost:5173` (debería verse el placeholder del modelador).
3. API → `curl http://localhost:4000/api/health` debe responder:

```json
{ "status": "ok", "timestamp": "2026-09-23T00:58:35.938Z" }
```

4. Entrar: con `npm run seed` hecho, usar los botones de acceso rápido en
   `/login`; sin seed, crear el primer usuario en `/register`.

## Tests de browser

`npm run test:ui` corre los flujos en un Chrome real (Playwright, usando el
Chrome del sistema — no descarga nada). Levanta su propia API en el puerto 4100
con una **DB temporal** y su propio Vite en el 5174, así que no toca tus datos
de desarrollo ni los servidores que tengas levantados.

Cubren lo que las suites de API no ven: que la sesión llegue de verdad, que
recargar la página no cierre la sesión, el historial con autores y el modo
lectura. Ese caso existe porque el login pasaba los tests de API pero en el
browser la app volvía a `/login` sin error: al recargar salían dos
`POST /api/auth/refresh` en paralelo, la rotación de refresh tokens invalidaba el
token del primero, el segundo recibía 401 y eso borraba la sesión recién creada.

### Por qué la base se siembra antes y no en el `globalSetup`

`npm run test:ui` dispara antes `pretest:ui`, que siembra la base temporal
(`client/e2e/prepare.ts`). El orden no es un detalle: **Playwright levanta los
`webServer` antes de correr el `globalSetup`** (en su runner,
`createGlobalSetupTasks` = `removeOutputDirs` → `pluginSetup` → `globalSetup`).
La API abre el archivo SQLite al arrancar y queda con ese inode abierto.

Si el seed corriera en el `globalSetup`, el orden real sería: la API abre la base
de la corrida anterior → el seed borra el archivo y crea uno nuevo con los datos
frescos → la API sigue sirviendo el archivo viejo, ya borrado del disco. Los
tests leen entonces datos de la corrida anterior y fallan por motivos que no
tienen nada que ver con el código, con errores que apuntan a cualquier lado
(este proyecto lo sufrió: la suite veía un catálogo de 2 procesos cuando el
código ya tenía 100).

Por eso el `globalSetup` solo **verifica**: que la base en disco tenga el
catálogo completo y que la API esté sirviendo esa misma base, comparando los
nombres que devuelve contra los del archivo. Si no coinciden, dice cuáles
sobran y avisa que hay un server vivo de una corrida anterior.

Si corrés `npx playwright test` a mano, saltás el paso previo y el `globalSetup`
te dice qué comando correr. Los puertos 4100 y 5174 tienen que estar libres: si
no, Playwright avisa antes de empezar.

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