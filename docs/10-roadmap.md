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

## Fase 3 — Persistencia en server ⏳

- [ ] Definir motor de base de datos (ver AD-010)
- [ ] CRUD de procesos (`/api/processes`)
- [ ] Versionado de procesos (`ProcessVersion`)
- [ ] Listado y búsqueda de procesos en el client

## Fase 4 — Colaboración y publicación ⏳

- [ ] Usuarios y autenticación
- [ ] Compartir procesos (link público / permisos)
- [ ] Historial de cambios por versión

## Fase 5 — Ejecución (en evaluación) ⏳

Solo si se resuelve [AD-008](./09-decisiones-de-diseno.md) a favor de ejecutar:

- [ ] Motor de instancias de proceso
- [ ] Tareas asignadas a usuarios/roles
- [ ] Panel de "mis tareas"
- [ ] Avance de flujo (aprobar/rechazar/derivar)

## Notas

- El orden de las fases puede cambiar según las decisiones abiertas (AD-006, AD-008).
- Cada fase completa su trabajo con la **actualización de la documentación** correspondiente (regla del proyecto, ver [11 — Convenciones](./11-convenciones-y-flujo-de-trabajo.md)).