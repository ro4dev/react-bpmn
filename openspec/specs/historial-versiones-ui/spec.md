# historial-versiones-ui Specification

## Purpose
TBD - created by archiving change colaboracion-publicacion. Update Purpose after archive.

## Requirements

### Requirement: Panel de historial de versiones

El client SHALL mostrar un panel lateral con el listado de versiones de un proceso, permitiendo ver diff visual y restaurar.

#### Scenario: Abrir historial

- **WHEN** el usuario clickea "Historial" en la toolbar (editor)
- **THEN** se abre panel lateral `VersionHistory` con lista de versiones DESC (`version`, `comment`, `createdAt`, `authorName`)
- **THEN** la lista viene de `GET /api/processes/:id/versions`

#### Scenario: Ver diff de una versión

- **WHEN** el usuario clickea una versión vK en la lista
- **THEN** el panel muestra diff visual comparando vK vs vK-1 (o vs v1 si K=1):
  - Nodos **added** (verdes): en vK no en vK-1
  - Nodos **removed** (rojos): en vK-1 no en vK
  - Nodos **changed** (amarillos): mismo id, distinta label/position/props
  - Edges **added/removed/changed** (mismo criterio)
- **THEN** el diff usa `ProcessModel` puro (sin React Flow), colores consistentes

#### Scenario: Restaurar versión anterior

- **WHEN** el usuario clickea "Restaurar esta versión" en vK
- **THEN** el client envía `PUT /api/processes/:id` con `{ model: <modelo de vK>, comment: "Restaurado desde vK" }`
- **THEN** el server crea versión N+1 con ese modelo → responde `200` con proceso actualizado
- **THEN** el editor actualiza a vN+1 (modelo restaurado), cierra panel historial, muestra mensaje "Restaurado vK como vN+1"

---

### Requirement: Diff visual reutilizable

El diff SHALL ser una función pura que tome dos `ProcessModel` y devuelva `{ nodes: Diff[], edges: Diff[] }` donde `Diff = { type: "added" | "removed" | "changed", id: string, before?: any, after?: any }`.

#### Scenario: Diff de nodos

- **WHEN** se comparan `modelA` y `modelB`
- **THEN** para cada id en unión de nodos:
  - solo en B → `{ type: "added", id, after: nodeB }`
  - solo en A → `{ type: "removed", id, before: nodeA }`
  - en ambos con diff en label/position/props → `{ type: "changed", id, before: nodeA, after: nodeB }`

#### Scenario: Diff de edges

- Mismo criterio que nodos, comparando `source`, `target`, `label`.

---

### Requirement: Integración en toolbar

El editor SHALL tener botones "Historial" y "Compartir" visibles según rol.

#### Scenario: Botones en toolbar

- **WHEN** proceso abierto en editor
- **THEN** toolbar muestra:
  - Badge rol actual (`Owner` / `Editor` / `Viewer`)
  - Botón "Historial" (abre `VersionHistory`) — visible para owner/editor/viewer
  - Botón "Compartir" (abre `ShareModal`) — visible solo para owner

---

### Requirement: Modal compartir

El client SHALL permitir al owner invitar/quitar colaboradores desde un modal.

#### Scenario: Abrir modal compartir

- **WHEN** owner clickea "Compartir" en toolbar
- **THEN** se abre `ShareModal` con:
  - Input email + select rol (Editor/Viewer) + botón "Invitar"
  - Lista colaboradores actuales: email, nombre, rol, botón "Quitar" (solo si no es owner)
- **THEN** "Invitar" llama `POST /api/processes/:id/collaborators` → actualiza lista
- **THEN** "Quitar" llama `DELETE /api/processes/:id/collaborators/:userId` → actualiza lista
