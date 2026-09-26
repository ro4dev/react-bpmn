# react-bpmn

> Modelador web de procesos de negocio.

Herramienta web para modelar procesos internos de una organización — contratación de personal, validación de solicitudes, flujos de aprobación, etc. — de forma **visual**, pensada para que tanto **personas de negocio** como **analistas técnicos** puedan dibujar, documentar y (a futuro) ejecutar sus procesos.

---

## Índice de documentación

Toda la documentación del proyecto vive en [`docs/`](./docs/), en formato `.md`.

| Doc | Contenido |
| --- | --- |
| [01 — Visión y alcance](./docs/01-vision-y-alcance.md) | Qué es, para quién, qué resuelve, qué está fuera de alcance |
| [02 — Arquitectura](./docs/02-arquitectura.md) | Diseño de alto nivel, componentes, flujo de peticiones |
| [03 — Guía de setup](./docs/03-guia-de-setup.md) | Requisitos, instalación y comandos |
| [04 — Estructura del proyecto](./docs/04-estructura-del-proyecto.md) | Árbol de carpetas y archivos, uno por uno |
| [05 — Frontend](./docs/05-frontend.md) | Stack, convenciones y plan del cliente web |
| [06 — Backend](./docs/06-backend.md) | Stack, convenciones y plan de la API |
| [07 — API](./docs/07-api.md) | Endpoints actuales y planeados, con ejemplos |
| [08 — Modelo de datos](./docs/08-modelo-de-datos.md) | Entidades del dominio y esquema de la base |
| [09 — Decisiones de diseño](./docs/09-decisiones-de-diseno.md) | ADRs: por qué se eligió cada cosa |
| [10 — Roadmap](./docs/10-roadmap.md) | Fases de desarrollo y estado actual |
| [11 — Convenciones y flujo de trabajo](./docs/11-convenciones-y-flujo-de-trabajo.md) | Git, código, documentación |

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite 8 + TypeScript + React Router 7 |
| Modelador visual | React Flow (`@xyflow/react`) 12.x (Fase 1) |
| Backend | Node + Express 5 + TypeScript |
| **Base de datos** | **node:sqlite nativo** (`DatabaseSync`, Fase 3) |
| **Autenticación** | **email/password + JWT** (bcrypt + jsonwebtoken, Fase 4) |
| Modelo compartido | `shared/` vía alias `@shared/*` (Fase 3) |
| Lint | oxlint |
| Dev | `concurrently` (levanta client y server juntos) |

## Estructura rápida

```
react-bpmn/
├── client/   → Frontend (Vite + React + TS)
├── server/   → API (Express + TS)
├── shared/   → Modelo + validación compartida (Fase 3)
└── docs/     → Documentación (.md)
```

## Arranque rápido

Requisitos: **Node 20+** (probado con Node 25) y npm 10+.

```bash
npm install --prefix client
npm install --prefix server
npm install

# La API necesita un secreto para firmar los JWT (obligatorio desde la Fase 4)
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# → pegá el valor en JWT_SECRET= dentro de server/.env

npm run dev
```

- Frontend → http://localhost:5173
- API → http://localhost:4000 (probá con `GET /api/health`)

### Datos de prueba (opcional)

```bash
npm run seed        # 2 usuarios + 100 procesos de negocio con historial, roles e invitación
npm run seed:reset  # regenera los datos demo (borra solo los datos demo, no tu trabajo)
```

 obviás el registro manual. Después en `/login` entrás con un clic: **Ana** (owner
de 95 procesos) o **Bruno** (editor de 32, viewer de 1, owner de 5). Es el login
normal con credenciales conocidas, no un bypass de la autenticación.

Los 100 procesos vienen de un catálogo de 12 áreas (personas, contratación,
compras, inventario, ventas, logística, servicio al cliente, calidad, finanzas,
legal, tecnología y salud) con cinco formas de diagrama, de lineal a compuesto:
51 simples y 31 enrevesados, todos válidos y con historial de 2 a 4 versiones.

Comandos completos en [03 — Guía de setup](./docs/03-guia-de-setup.md).

---

## Estado del proyecto

**Fase actual: 4 — Colaboración y publicación ✅** (siguiente: Fase 5 — ejecución, requiere decisión de producto)

- **Editor visual**: canvas React Flow con paleta (**Inicio, Fin, Tarea, Decisión**), drag-and-drop de nodos, conexiones, minimapa, snap-to-grid y panel de propiedades.
- **Validación en tiempo real**: panel de issues (errores/advertencias) al modelar — ver `client/src/lib/validation/`.
- **Deshacer/rehacer**: historial de snapshots con `Ctrl+Z` / `Ctrl+Shift+Z` y botones (AD-012).
- **Exportación**: PNG/SVG del diagrama con `html-to-image` (AD-013).
- **Guardado local** (`localStorage`) con autoguardado; exportar/importar el modelo como JSON.
- **Persistencia server (Fase 3 ✅)**: CRUD `/api/processes` + versionado inmutable `ProcessVersion` + validación server-side con `validateProcess` compartido.
- **Usuarios y sesión (Fase 4 ✅)**: registro/login propio con bcrypt (12 rondas), access token JWT de 15 min en memoria y refresh token opaco de 7 días en cookie httpOnly, con rotación (AD-017).
- **Colaboración (Fase 4 ✅)**: permisos por proceso con roles `owner` / `editor` / `viewer`; invitación por email (directa si el usuario existe, por token firmado de 7 días si todavía no se registró); el listado filtra Míos / Compartidos / Todos (AD-018, AD-019).
- **Historial visible (Fase 4 ✅)**: panel lateral con el diff semántico entre versiones, el autor de cada guardado y restauración que crea una versión nueva sin borrar el historial (AD-020).
- **Modelo compartido**: `shared/` (`ProcessModel` + `validateProcess`) consumido por client y server (AD-015).
- **Base de datos**: SQLite nativo (`node:sqlite` + `DatabaseSync`) en `server/src/db/`, modo WAL (AD-010, AD-014).
- **Datos de prueba**: `npm run seed` siembra 2 usuarios y **100 procesos de negocio** (12 áreas, de lineal a compuesto, con historial de varios autores, colaboradores de los tres roles y una invitación pendiente) — para recorrer la app sin registrar nada (ver [03 — Guía de setup](./docs/03-guia-de-setup.md)).
- **Tests**: `npm test` corre las cinco suites — 47 aserciones end-to-end de la API, 22 de unidad del `ProcessStore` (autoría, caché de roles, consultas), 53 del seed (catálogo válido, historial que crece, idempotencia, `--reset`), 12 del diff semántico y **10 tests de browser con Playwright** (sesión, recarga, catálogo completo y buscable, proceso enrevesado, un proceso de cada forma, historial con autores, modo lectura). Lógica: `node:test` + `--experimental-strip-types`, sin framework.
- Planificación con OpenSpec: changes archivados en `openspec/changes/archive/` (ver [Roadmap](./docs/10-roadmap.md)).