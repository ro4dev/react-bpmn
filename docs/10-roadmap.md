# 10 — Roadmap

> Documento: `docs/10-roadmap.md`
>
> Fases de desarrollo. El estado de cada fase se marca con ✅ (completada), 🚧 (en curso) o ⏳ (pendiente).

## Fase 0 — Scaffold ✅

- [x] Repo `react-bpmn` creado (local + GitHub `ro4dev/react-bpmn`)
- [x] Frontend Vite + React + TS (`client/`)
- [x] Backend Express + TS (`server/`)
- [x] Scripts raíz con `concurrently`
- [x] Proxy de dev `/api` → 4000
- [x] Smoke test de `/api/health`
- [x] Documentación completa en `docs/`

## Fase 1 — Editor visual básico ✅

Objetivo: poder **dibujar un proceso** en el navegador.

- [x] Instalar `@xyflow/react` y montar el canvas (`Canvas`, `Palette`, `Toolbar`)
- [x] Definir paleta mínima: Inicio, Fin, Tarea, Decisión (confirmada con el usuario)
- [x] Drag-and-drop de nodos al canvas + conexiones entre ellos
- [x] Panel de propiedades para el nodo seleccionado (título, descripción, responsable)
- [x] Guardado local en el navegador (`localStorage`) + autoguardado
- [x] Exportar/importar el modelo como JSON

> Implementado y archivado en OpenSpec (`openspec/changes/archive/2026-09-22-editor-visual-basico/`). Validación manual opcional por parte del usuario: drag de los 4 tipos, conexiones, edición de propiedades, recarga con persistencia y export/import.

## Fase 2 — Maduración del editor ✅

- [x] Validación del proceso en vivo (`ValidationPanel`): vacío, falta de Inicio/Fin, múltiples Inicios, nodos aislados, no alcanzables y sin salida a Fin (AD-[012](./09-decisiones-de-diseno.md) — ver `lib/validation/`)
- [x] Deshacer/rehacer con historial de snapshots en `useProcessModel` (AD-012) + botones y atajos `Ctrl+Z` / `Ctrl+Shift+Z`
- [x] Estado local con hooks, sin librería global (AD-009 resuelto)
- [x] Minimapa, zoom y snap-to-grid
- [x] Exportar imagen PNG/SVG con `html-to-image` (AD-013) desde la toolbar

> Implementado y archivado en OpenSpec (`openspec/changes/archive/`). Validación manual opcional por parte del usuario: deshacer/rehacer en vivo, panel de validación ante un modelo incompleto, y exportación PNG/SVG.

## Fase 3 — Persistencia en server ✅

- [x] Motor de base de datos: **SQLite nativo** (`node:sqlite` + `DatabaseSync`) — AD-010 adoptada
- [x] Capa de datos aislada: `server/src/db/` (`schema.ts` + `processStore.ts`) — AD-014
- [x] CRUD de procesos: `POST/GET/GET:id/PUT/DELETE /api/processes`
- [x] Versionado inmutable: `ProcessVersion` + `GET /:id/versions` + `GET /:id/versions/:v` — AD-016
- [x] Validación server-side: `validateProcess` compartido (`@shared/validation/`) → 400 si inválido
- [x] Modelo compartido: `shared/` (`ProcessModel` + `validateProcess`) vía alias `@shared/*` — AD-015
- [x] Listado y búsqueda de procesos en el client (`ProcessList` + búsqueda `?q=`)
- [x] Guardar/cargar desde el editor + versión visible (`vN` en toolbar)

> Implementado y archivado en OpenSpec (`openspec/changes/archive/`). Validación: `npm run lint` 0/0 + `npm run build` OK en client y server.

## Fase 4 — Colaboración y publicación ✅

- [x] Usuarios y autenticación (AD-008 resuelto → [AD-017](./09-decisiones-de-diseno.md)): registro/login propio, bcrypt + JWT, refresh en cookie httpOnly, rutas protegidas en la UI
- [x] Permisos por proceso: roles `owner` / `editor` / `viewer`, badge de rol, panel de propiedades en solo lectura para viewers ([AD-018](./09-decisiones-de-diseno.md))
- [x] Compartir procesos: invitación por email (directa si el usuario existe, por token firmado si no), quitar colaboradores, cancelar invitaciones ([AD-019](./09-decisiones-de-diseno.md))
- [x] Historial de cambios por versión: panel lateral con diff semántico contra la versión anterior y restauración que crea la N+1 ([AD-020](./09-decisiones-de-diseno.md))
- [x] Listado con filtro Míos / Compartidos / Todos
- [x] Tests end-to-end de la API: `npm --prefix server run test:e2e` (40 aserciones)

> Implementado y archivado en OpenSpec (`openspec/changes/archive/2026-09-25-colaboracion-publicacion`). Validación: `npm run lint` 0 errores + `npm run build` OK en client y server + suite e2e en verde.

## Fase 5 — Ejecución ⏳

Fuera del alcance actual: [AD-008](./09-decisiones-de-diseno.md) se resolvió a favor de **modelar**, no ejecutar. Esta fase requiere una **decisión de producto nueva** antes de arrancar (instancias y su ciclo de vida, estados de tarea, disparadores, idempotencia, cómo se traduce `props` a una máquina de estados).

- [ ] Definir el modelo de instancias y el motor de ejecución
- [ ] Motor de instancias de proceso
- [ ] Tareas asignadas a usuarios/roles
- [ ] Panel de "mis tareas"
- [ ] Avance de flujo (aprobar/rechazar/derivar)

## Notas

- El orden de las fases puede cambiar según las decisiones abiertas (AD-006 sigue abierta: el formato propio del modelo es provisional).
- Cada fase completa su trabajo con la **actualización de la documentación** correspondiente (regla del proyecto, ver [11 — Convenciones](./11-convenciones-y-flujo-de-trabajo.md)).