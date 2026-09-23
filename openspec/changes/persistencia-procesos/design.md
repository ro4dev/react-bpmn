# Design

## Context

La Fase 2 dejó el editor completo (validación en tiempo real, deshacer/rehacer, exportación de imagen) pero con persistencia **solo local** (`localStorage`). La Fase 3 agrega el server: guardar/actualizar/eliminar procesos, listarlos y versionar cada guardado. Dos decisiones atraviesan todo: el **motor de datos** (AD-010, abierta) y **dónde vive el modelo compartido** entre client y server (formato de `ProcessModel` + validación pura de la Fase 2, hoy solo en `client/`).

## Goals / Non-Goals

**Goals:**

- Persistencia real en el server: CRUD de procesos + **versionado** por guardado.
- Listado y búsqueda de procesos en el client (nueva vista), con posibilidad de abrir un proceso en el editor.
- Guardar desde el editor contra el server, manteniendo el autoguardado local (`localStorage`) como capa offline de trabajo.
- Reutilizar la **validación pura** de la Fase 2 (`validateProcess`) **en el server** para rechazar modelos inválidos de forma de servidor.

**Non-Goals:**

- Autenticación/usuarios (Fase 4, AD-008 abierta).
- Colaboración/compartir enlaces (Fase 4).
- Historial de versiones en la UI (Fase 4) — aquí el server **almacena** las versiones (API), no hay timeline visual aún.
- Motor de ejecución de procesos (Fase 5, AD-008 abierta).

## Capabilities

### Nueva capability: `persistencia-server`

#### Requirement: Create process

El server SHALL crear un proceso a partir de un `ProcessModel` válido, asignando `id`, `createdAt`, `updatedAt` y una **primera versión** (`version: 1`) con el modelo completo y `comment` opcional. Un proceso SHALL crear su primera versión en la misma operación.

##### Scenario: Crear un proceso nuevo

- **WHEN** el client envía `POST /api/processes` con un `ProcessModel` válido y `name`
- **THEN** el server responde `201` con el proceso creado (con `id`, timestamps y `version: 1`)
- **AND** la primera `ProcessVersion` queda persistida con el modelo completo

##### Scenario: Crear con modelo inválido

- **WHEN** el client envía `POST /api/processes` con un `ProcessModel` que no pasa la validación (p. ej. sin Inicio)
- **THEN** el server responde `400` con los issues de validación (reusando `validateProcess`)
- **AND** no persiste ningún proceso

#### Requirement: List processes

El server SHALL listar los procesos con su **nombre**, **estado último** (`updatedAt`), **versión actual** y un **preview** (título y descripción computados del modelo), ordenados por fecha de actualización descendente. La respuesta SHALL incluir el total y SHALL permitir filtrar por substring del nombre mediante query param `q`.

##### Scenario: Listar todos los procesos

- **WHEN** el client hace `GET /api/processes`
- **THEN** el server responde `200` con la lista de procesos (sin los modelos completos, solo metadatos + preview)
- **AND** la lista viene ordenada por `updatedAt` descendente

##### Scenario: Buscar por nombre

- **WHEN** el client hace `GET /api/processes?q=onboarding`
- **THEN** el server responde `200` solo con los procesos cuyo nombre contiene "onboarding"

##### Scenario: Lista vacía

- **WHEN** no hay procesos persistidos
- **THEN** el server responde `200` con una lista vacía y `total: 0`

#### Requirement: Get process

El servidor SHALL devolver un proceso por `id` incluyendo su **modelo de la última versión** y los metadatos.

##### Scenario: Obtener un proceso existente

- **WHEN** el client hace `GET /api/processes/:id`
- **THEN** el server responde `200` con el proceso, su `version` actual y el `ProcessModel` de esa versión

##### Scenario: Proceso inexistente

- **WHEN** el client hace `GET /api/processes/:id` con un id que no existe
- **THEN** el server responde `404`

#### Requirement: Update process

El server SHALL actualizar un proceso (nombre y/o modelo) creando una **nueva versión** (`version + 1`) con el modelo reemplazado y `comment` opcional; el proceso refleja `updatedAt` nuevo. El update SHALL validar el modelo igual que el create.

##### Scenario: Guardar cambios con nueva versión

- **WHEN** el client envía `PUT /api/processes/:id` con un modelo válido y `comment: "agrego paso de aprobación"`
- **THEN** el server responde `200` con el proceso actualizado (`version: 2`, `updatedAt` nuevo)
- **AND** se persiste una nueva `ProcessVersion` (v2) con el modelo y el `comment`

##### Scenario: Actualizar un proceso inexistente

- **WHEN** el client envía `PUT /api/processes/:id` con un id que no existe
- **THEN** el server responde `404`

#### Requirement: Delete process

El server SHALL eliminar un proceso y **todas sus versiones** en cascada.

##### Scenario: Eliminar un proceso

- **WHEN** el client envía `DELETE /api/processes/:id`
- **THEN** el server responde `204`
- **AND** el proceso y sus versiones desaparecen de la base

##### Scenario: Eliminar un proceso inexistente

- **WHEN** el client envía `DELETE /api/processes/:id` con un id inexistente
- **THEN** el server responde `404`

#### Requirement: List process versions

El servidor SHALL listar las versiones de un proceso (número de versión, `comment`, `createdAt`, autor — vacío hasta Fase 4) en orden descendente.

##### Scenario: Listar versiones de un proceso

- **WHEN** el client hace `GET /api/processes/:id/versions`
- **THEN** el server responde `200` con el listado de versiones del proceso (metadatos, sin modelos completos)

##### Scenario: Versiones de un proceso inexistente

- **WHEN** el client hace `GET /api/processes/:id/versions` con un id inexistente
- **THEN** el server responde `404`

## Decisions

### D1 — Motor de persistencia: SQLite nativo `node:sqlite` (resuelve AD-010)

**Contexto:** la Fase 2 dejó AD-010 **abierta** (candidatos SQLite vs Postgres). Se evaluó de nuevo con datos reales: Node 25.8.1 trae `node:sqlite` (`DatabaseSync`) **nativo, sin compilar nada y sin dependencias** — smoke verificado (`CREATE TABLE` + `INSERT` + `SELECT` OK). Postgres solo aportaría si aparece un hosting compartido real, y no es el caso.

**Decisión:** ✅ **Adoptada (Fase 3):** usar **`node:sqlite`** (`DatabaseSync`, síncrono, cero deps) con el archivo en `server/data/processes.db`. La capa de datos queda aislada en `server/src/db/` (schema + store) para poder migrar a Postgres sin tocar rutas si algún día el hosting lo pide (coherente con la conclusión del AD-010 de "capa aislada").

**Consecuencias:** cero dependencias nuevas en el server; `node:sqlite` es síncrono (suficiente para un editor de baja concurrencia); el archivo `.db` se ignora en git (`.gitignore`: `server/data/`).

### D2 — Modelo y validación compartidos: `shared/` en la raíz sin paquete buildable

**Contexto:** la validación pura (`validateProcess`) y los tipos `ProcessModel` viven en `client/` (Fase 2, AD-013 "punto único a reutilizar en la Fase 3"). El server necesita validar igual que el client al crear/actualizar. Reusar requiere que el código viva en un lugar que **ambos** consuman.

**Decisión:** ✅ **Adoptada:** crear `shared/` en la raíz del monorepo con los **tipos del modelo + validación pura** (movido de `client/src/lib/validation/` y `client/src/lib/model/types.ts`), consumido por **client y server vía path alias de TypeScript** (`@shared/*`) — **sin paquete publicado ni build intermedio** (ambos compilan desde la fuente TS).

- *Fallo posible y mitigación:* si el build del server (tsc con `rootDir: src`) no permite importar fuera de `src/`, se ajusta el tsconfig (ampliar `rootDir`/`include`) o se configura el path alias en Vite (`resolve.alias`) + `tsconfig.json` `paths` del client. Si aun así rompe, el **fallback documentado** es copiar la validación al server en `server/src/lib/validation/` con un comentario explícito de "copia sincronizada con `shared/`" (se registraría como consecuencia de AD-012).

**Consecuencias:** el `ProcessModel` y su validación son **única fuente de verdad** en `shared/`; client y server compilan desde esa fuente; se elimina la duplicación que la Fase 2 mantuvo a propósito (era local).

### D3 — Versionado: `ProcessVersion` inmutable por guardado

**Contexto:** cada guardado de un proceso debe quedar recuperable. Opciones: sobrescribir el modelo (sin historial) o guardar versiones inmutables.

**Decisión:** ✅ **Adoptada:** dos tablas: `Process` (metadatos + `currentVersion`) y `ProcessVersion` (número, modelo JSON, `comment`, `createdAt`), **inmutable** — nunca se modifica una versión ya escrita; `update` crea `version + 1`. El `GET /:id` devuelve `Process.currentVersion`. La UI del historial de versiones (timeline) es de la Fase 4; el server ya queda preparado (AD-013 requiere que el esquema permita *algún día* ejecutar).

**Consecuencias:** el esquema aisla la geometría (React Flow) de la semántica de los nodos dentro del modelo almacenado (contexto AD-008/AD-011): se guarda el `ProcessModel` persistible (no el estado de trabajo del editor), manteniendo la separación del AD-011.

## Risks / Trade-offs

- [`node:sqlite` es síncrono (bloquea el event loop)] → Aceptado: editor de baja concurrencia y payloads pequeños; si la Fase 4 escala, se migra la capa a `node:sqlite` async (WAL) o Postgres sin tocar rutas (D1).
- [Path alias `@shared/*` entre client/ y server/ puede pelear con el build de Vite/tsc] → Mitigado en D2 con fallback documentado (copia sincronizada). Se verifica con `npm run build` en client y server antes de cerrar.
- [Autoguardado local vs server pueden divergir] → El server es la fuente de verdad para procesos **guardados**; el autoguardado local sigue siendo la capa de trabajo sin guardar (no se elimina, AD-011). Mientras no hay colaboración, la divergencia se resuelve con un botón explícito "Guardar en server".
- [Versiones crecen sin límite] → Aceptado por ahora (baja volumetría); la poda/borrado de versiones viejas se evalúa en la Fase 4 con el timeline de versiones.

## Migration Plan

No hay datos previos que migrar: la Fase 2 no persistió en server. La creación de tablas (`CREATE TABLE IF NOT EXISTS`) se ejecuta al arrancar el server (`server/src/db/schema.ts`). Los procesos ya guardados en `localStorage` por el usuario **no** se migran automáticamente; quedan exportables/importables vía JSON (Fase 1) y se pueden guardar al server manualmente desde el editor.

## Open Questions

- **¿Timeline de versiones en la UI?** El server almacena versiones (esta fase), pero la vista visual del historial y la restauración de una versión anterior quedan para la **Fase 4** (requiere decisión de producto sobre el historial, AD-008). Se reporta al terminar.
- **¿Poda de versiones?** Sin límite por ahora; se decide con el timeline (Fase 4).
