# persistencia-server Specification

## Purpose
TBD - created by archiving change persistencia-procesos. Update Purpose after archive.

## Requirements

### Requirement: Crear proceso

El server SHALL crear un proceso a partir de un `ProcessModel` válido, asignando `id`, `createdAt`, `updatedAt` y una **primera versión** (`version: 1`) con el modelo completo y `comment` opcional. Un proceso SHALL crear su primera versión en la misma operación.

#### Scenario: Crear un proceso nuevo

- **WHEN** el client envía `POST /api/processes` con un `ProcessModel` válido y `name`
- **THEN** el server responde `201` con el proceso creado (con `id`, timestamps y `version: 1`)
- **AND** la primera `ProcessVersion` queda persistida con el modelo completo

#### Scenario: Crear con modelo inválido

- **WHEN** el client envía `POST /api/processes` con un `ProcessModel` que no pasa la validación (p. ej. sin Inicio)
- **THEN** el server responde `400` con los issues de validación (reusando `validateProcess`)
- **AND** no persiste ningún proceso

### Requirement: Listar procesos

El server SHALL listar los procesos con **metadatos y preview** — `name`, `status` (derivado de la validación del modelo), `version` (última), `updatedAt`, `versionCount` y un preview textual —, ordenados por `updatedAt` descendente, y SHALL permitir filtrar por substring en `name` vía query param `q`.

#### Scenario: Listar todos los procesos

- **WHEN** el client hace `GET /api/processes`
- **THEN** el server responde `200` con la lista de procesos (metadatos + preview, sin modelos completos)

#### Scenario: Filtrar por nombre

- **WHEN** el client hace `GET /api/processes?q=onboarding`
- **THEN** el server responde `200` solo con los procesos cuyo nombre contiene "onboarding"

#### Scenario: Lista vacía

- **WHEN** no hay procesos persistidos
- **THEN** el server responde `200` con una lista vacía

### Requirement: Obtener un proceso

El server SHALL devolver un proceso por `id` incluyendo su modelo de la **última versión** y los metadatos.

#### Scenario: Obtener un proceso existente

- **WHEN** el client hace `GET /api/processes/:id`
- **THEN** el server responde `200` con el proceso, su `version` actual y el `ProcessModel` de la última versión

#### Scenario: Proceso inexistente

- **WHEN** el client hace `GET /api/processes/:id` con un id que no existe
- **THEN** el server responde `404`

### Requirement: Actualizar un proceso

El server SHALL actualizar un proceso (nombre y/o modelo) creando una **nueva versión** (`version + 1`) con el modelo reemplazado y `comment` opcional, validando el modelo igual que en el create, y SHALL devolver el proceso actualizado.

#### Scenario: Guardar cambios con nueva versión

- **WHEN** el client envía `PUT /api/processes/:id` con un modelo válido y `comment`
- **THEN** el server responde `200` con el proceso (`version: 2`, `updatedAt` nuevo)
- **AND** se persiste una nueva `ProcessVersion` (v2) con el modelo y el `comment`

#### Scenario: Actualizar un proceso inexistente

- **WHEN** el client envía `PUT /api/processes/:id` con un id que no existe
- **THEN** el server responde `404`

### Requirement: Eliminar un proceso

El server SHALL eliminar un proceso y **todas sus versiones** en cascada.

#### Scenario: Eliminar un proceso

- **WHEN** el client envía `DELETE /api/processes/:id`
- **THEN** el server responde `204`
- **AND** el proceso y sus versiones desaparecen de la base

#### Scenario: Eliminar un proceso inexistente

- **WHEN** el client envía `DELETE /api/processes/:id` con un id inexistente
- **THEN** el server responde `404`

### Requirement: Listar versiones de un proceso

El server SHALL listar las versiones de un proceso (número de versión, `comment`, `createdAt`, metadatos) en orden descendente.

#### Scenario: Listar versiones de un proceso existente

- **WHEN** el client hace `GET /api/processes/:id/versions`
- **THEN** el server responde `200` con el listado de versiones (sin modelos completos)

#### Scenario: Versiones de un proceso inexistente

- **WHEN** el client hace `GET /api/processes/:id/versions` con un id inexistente
- **THEN** el server responde `404`
