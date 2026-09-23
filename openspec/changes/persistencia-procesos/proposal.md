# Proposal

## Why

La Fase 2 entregó un editor maduro (validación en tiempo real, deshacer/rehacer, exportación de imagen), pero **todo el trabajo vive en el navegador**: el modelo solo se guarda en `localStorage` de cada máquina. No hay forma de compartir un proceso con otra persona, de tener un historial durable de versiones ni de listar/buscar los procesos del equipo. Para que la herramienta sirva *de verdad* en una organización hace falta un **server con persistencia**: guardar, cargar, versionar y listar procesos de manera central.

## What Changes

- **Persistencia server-side en SQLite** (AD-010 resuelto): la capa de datos pasa a `server/src/db/` aislada del resto, usando `node:sqlite` nativo (`DatabaseSync`, cero dependencias, verificado en Node 25.8.1). Tablas `Process` y `ProcessVersion`.
- **CRUD de procesos** (`/api/processes`): crear, listar, obtener un proceso (con su última versión), actualizar (crea una versión nueva) y eliminar.
- **Versionado**: cada guardado de un proceso crea una `ProcessVersion` (v1, v2, …) con el modelo completo y un `comment` opcional. El server valida la forma del modelo reutilizando la lógica de validación compartida (`client/` → mover a `shared/`).
- **Listado en el frontend con búsqueda**: nueva vista `ProcessList` que consulta `/api/processes` (nombre + estado + versión + fecha), con búsqueda por nombre, y permite abrir un proceso en el editor.
- **Carga/guardado desde el editor**: botón "Guardar en server" (crea/actualiza un proceso y su versión) y "Abrir" que carga desde la lista; el autoguardado local (`localStorage`) sigue funcionando en paralelo (estado de trabajo siempre disponible offline).

## Impact

- **`server/`**:
  - Nueva dependencia: ninguna (usa `node:sqlite` nativo).
  - `src/db/schema.ts` → esquema SQLite (`Process`, `ProcessVersion`).
  - `src/db/processStore.ts` → capa de datos aislada (CRUD + versionado).
  - `src/routes/processes.ts` → router Express con `/api/processes` (+ `GET /:id/versions`).
  - `src/app.ts` → montar router.
  - `src/index.ts` → inicializar DB al arrancar.
- **`shared/`** (nuevo, raíz del monorepo): tipo `ProcessModel`, tipos del modelo y la validación pura (`validateProcess`), movidos desde `client/` para reutilizarlos en el server (decisiones de la Fase 3, AD-010).
- **`client/`**:
  - `src/lib/api/processes.ts` → cliente HTTP tipado para `/api/processes`.
  - `src/features/processes/ProcessList.tsx` → listado con búsqueda + botón "Abrir en editor".
  - `src/App.tsx` → alternar entre lista de procesos y editor; "Guardar en server" en la toolbar.
  - `src/hooks/useProcessModel.ts` → carga inicial desde server + guardar en server.
  - El estado local/autoguardado (Fase 2) se mantiene intacto.
- **Documentación**: AD-010 resuelto (SQLite `node:sqlite`), ADR para el formato compartido (`shared/`), actualizar `docs/06-backend.md`, `docs/07-api.md`, `docs/08-modelo-de-datos.md`, `docs/10-roadmap.md` (Fase 3 ✅) y `README.md` (Fase actual 3).
- **`.gitignore`**: agregar `server/data/` (archivos `*.db`).

> Decisión técnica pendiente dentro de la Fase 3 (ver design.md): cómo compartir `client` ⇄ `server` el modelo (monorepo `shared/`). Se resuelve aquí; la alternativa de copia server-local queda descartada en favor del paquete compartido.
