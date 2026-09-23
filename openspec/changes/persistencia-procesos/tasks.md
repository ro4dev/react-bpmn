# Tasks

## 1. Capa de datos del server (SQLite)

- [ ] 1.1 Crear `server/src/db/schema.ts` (tablas `Process` + `ProcessVersion` con `CREATE TABLE IF NOT EXISTS`, índices) y `server/src/db/processStore.ts` (CRUD + versionado con `DatabaseSync` de `node:sqlite`), y verificar con un smoke ad-hoc (`npx tsx`) que se crean las tablas y un `INSERT`/`SELECT`/`DELETE` básico funciona (replicando el smoke de AD-010)
- [ ] 1.2 Agregar `server/data/` a `.gitignore` (`server/data/*.db`) y verificar con `git status` que no tracker el archivo de DB
- [ ] 1.3 Escribir la capa de modelos `server/src/models/` (reutilizando el `ProcessModel`/`validateProcess` compartidos, ver D2) y verificar que `npm --prefix server run build` compila con el path alias `@shared`
- [ ] 1.4 Sincronizar/validar el formato compartido (`shared/`) — mover `ProcessModel`+validación pura desde `client/` a `shared/`, ajustar imports en `client/` y `server/`, y verificar que **ambos** builds compilan y el runtime del client sigue funcionando (editor + validación + serialización sin cambios visibles)

## 2. API de procesos

- [ ] 2.1 Crear `server/src/routes/processes.ts` con `POST /api/processes`, `GET /api/processes`, `GET /api/processes/:id`, `PUT /api/processes/:id` y `DELETE /api/processes/:id`, montarlo en `app.ts`, y verificar con curl/smoke que cada endpoint responde el status y payload esperados (incluyendo `404` para ids inexistentes y `400` para modelos inválidos)
- [ ] 2.2 Crear `GET /api/processes/:id/versions` (listado descendente de versiones metadatos) y `GET /api/processes/:id/versions/:v` (modelo completo de una versión), y verificar con smoke que devuelven el formato y status correctos
- [ ] 2.3 Validar en el server cada modelo al crear/actualizar (reusando `validateProcess` compartido): si hay errores responder `400` con los issues, y verificar con smoke que un modelo válido pasa y uno inválido (sin Inicio/Fin) es rechazado

## 3. Client: API + listado de procesos

- [ ] 3.1 Crear `client/src/lib/api/processes.ts` (cliente HTTP tipado para `/api/processes`) y verificar con smoke (`npx tsx`) que serializa/deserializa los payloads correctamente contra el server en dev
- [ ] 3.2 Crear `features/processes/ProcessList.tsx` (búsqueda por nombre, tabla/listado con nombre, estado, versión, fecha; "abrir" y "nuevo proceso") y `features/processes/ProcessList.css`, y verificar manualmente que lista procesos reales desde el server, filtra por nombre y permite abrir en el editor
- [ ] 3.3 Integrar el listado en `App.tsx` (cambiar entre vista editor y lista con breadcrumb/navegación) y verificar manualmente que navegar lista ⇄ editor funciona y el proceso abierto se carga inicialmente desde el server

## 4. Guardar/cargar en el editor + versionado visible

- [ ] 4.1 En `useProcessModel`: agregar "Guardar en server" (persiste el modelo actual como nueva versión, mostrando el comentario opcional) y "Cargar última versión" si el proceso viene de la lista, y verificar manualmente que guardar en server y recargar recupera la última versión guardada, y que el autoguardado local sigue funcionando en paralelo
- [ ] 4.2 Mostrar en el editor el número de versión actual del proceso abierto (e.g. "v3" en estado de pie) y verificar manualmente que se actualiza tras cada guardado en server
- [ ] 4.3 Verificar manualmente (smoke `npx tsx` + manual) que el flujo completo `crear → guardar server → versionado (2+ guardados generan v1→v2→v3) → listar → abrir → editar → guardar` funciona de extremo a extremo, y que `GET /:id/versions` refleja el histórico

## 5. ADR, documentación y cierre

- [ ] 5.1 Resolver AD-010 en `docs/09-decisiones-de-diseno.md` (✅ adoptada Fase 3: SQLite con `node:sqlite`, verificado) y agregar **AD-014 (capa de datos aislada con `DatabaseSync`)**, **AD-015 (formato compartido en `shared/` con path alias)** y documentar el versionado server (AD-016: versionado con `ProcessVersion`, opcional deducible de AD-010), y verificar la tabla del documento
- [ ] 5.2 Actualizar `docs/06-backend.md` (estructura con `db/`, `models/`, rutas de procesos), `docs/07-api.md` (endpoints de procesos con ejemplos), `docs/08-modelo-de-datos.md` (entidades `Process` + `ProcessVersion`) y `docs/10-roadmap.md` (Fase 3 ✅) y verificar que los cambios quedan documentados
- [ ] 5.3 Correr `npm run lint` (client, server y raíz) con 0 errores, `npm run build` en client y server OK, y marcar las tareas completadas y archivar el change
