# autorizacion-procesos Specification

## Purpose
Decidir quién puede hacer qué sobre cada proceso. Sin esto, con varios usuarios, cualquiera que conozca un id podría leer o pisar el trabajo de otro. Cubre la asignación automática del owner, los tres roles (`owner` / `editor` / `viewer`), el rechazo de operaciones sin permiso y la traducción de ese permiso a la UI (badges, acciones deshabilitadas, solo lectura). Ver [AD-018](../../docs/09-decisiones-de-diseno.md#ad-018-autorizacion-por-proceso-ownereditorviewer).

## Requirements

### Requirement: Owner automático al crear proceso

Al crear un proceso (`POST /api/processes`), el server SHALL asignar `ownerId = req.user.id` y crear entrada en `ProcessCollaborator` con rol `owner`.

#### Scenario: Crear proceso autenticado

- **WHEN** usuario autenticado envía `POST /api/processes` con modelo válido
- **THEN** el server responde `201` con proceso que incluye `ownerId` del usuario
- **AND** existe `ProcessCollaborator` con `role: "owner"` para ese usuario-proceso

#### Scenario: No autenticado

- **WHEN** request sin access token válido a `POST /api/processes`
- **THEN** el server responde `401` con `{ error: "No autenticado" }`

---

### Requirement: Validar permisos en cada operación

El server SHALL rechazar con `403` si el usuario no tiene permiso para la operación solicitada.

| Operación | owner | editor | viewer | sin acceso |
|-----------|-------|--------|--------|------------|
| GET /:id | ✅ | ✅ | ✅ | ❌ |
| PUT /:id (guardar versión) | ✅ | ✅ | ❌ | ❌ |
| DELETE /:id | ✅ | ❌ | ❌ | ❌ |
| POST /:id/collaborators | ✅ | ❌ | ❌ | ❌ |
| GET /:id/versions | ✅ | ✅ | ✅ | ❌ |
| GET /:id/versions/:v | ✅ | ✅ | ✅ | ❌ |

#### Scenario: Acceso denegado

- **WHEN** usuario sin permiso intenta `PUT /api/processes/:id`
- **THEN** el server responde `403` con `{ error: "Permiso insuficiente" }`

#### Scenario: Proceso inexistente

- **WHEN** usuario autenticado accede a proceso que no existe
- **THEN** el server responde `404` con `{ error: "Proceso no encontrado" }`

---

### Requirement: Invitar colaborador

El server SHALL permitir al owner invitar a otro usuario por email con rol `editor` o `viewer`.

#### Scenario: Invitar usuario existente

- **WHEN** owner envía `POST /api/processes/:id/collaborators` con `{ email: "user@existente.com", role: "editor" }`
- **THEN** el server responde `201` con `{ collaborator: { processId, userId, role: "editor", invitedAt } }`
- **AND** crea `ProcessCollaborator` directo

#### Scenario: Invitar usuario nuevo (invitación)

- **WHEN** owner envía `POST /api/processes/:id/collaborators` con `{ email: "nuevo@user.com", role: "viewer" }` y el email no está registrado
- **THEN** el server responde `201` con `{ collaborator: null, invitation: { token, expiresAt } }`
- **AND** crea `Invitation` con token JWT firmado (expira 7 días)
- **AND** loggea en consola: `"[invite] Link para nuevo@user.com: /accept?token=..."`

#### Scenario: No es owner

- **WHEN** editor/viewer envía `POST /api/processes/:id/collaborators`
- **THEN** el server responde `403` con `{ error: "Solo el owner puede invitar colaboradores" }`

---

### Requirement: Listar colaboradores

El server SHALL listar colaboradores de un proceso (owner/editor/viewer pueden ver).

#### Scenario: Listar colaboradores

- **WHEN** usuario con acceso hace `GET /api/processes/:id/collaborators`
- **THEN** el server responde `200` con `[{ userId, email, name, role, invitedAt }]`

---

### Requirement: Quitar colaborador

El server SHALL permitir al owner quitar un colaborador (no al owner).

#### Scenario: Quitar colaborador válido

- **WHEN** owner envía `DELETE /api/processes/:id/collaborators/:userId`
- **THEN** el server responde `204`
- **AND** elimina `ProcessCollaborator`

#### Scenario: Intentar quitar al owner

- **WHEN** owner envía `DELETE /api/processes/:id/collaborators/:ownerId`
- **THEN** el server responde `400` con `{ error: "No se puede quitar al owner" }`

---

### Requirement: Aceptar invitación

El server SHALL permitir aceptar una invitación vía token.

#### Scenario: Aceptar invitación válida (usuario existente)

- **WHEN** usuario logueado hace `POST /api/invitations/accept` con `{ token }` válido
- **THEN** el server responde `200` con `{ collaborator }` y crea `ProcessCollaborator`
- **AND** invalida la invitación (uso único)

#### Scenario: Aceptar invitación (usuario nuevo → registro + accept)

- **WHEN** usuario no registrado hace `POST /api/invitations/accept` con `{ token }` válido
- **THEN** el server responde `200` con `{ collaborator, user }` (requiere completar registro o login previo)
- **ALTERNATIVA**: flujo en dos pasos: 1) `POST /accept` con token → devuelve `{ email, processId, role }` para pre-llenar registro; 2) registro/login → auto-acepta invitación pendiente.

#### Scenario: Token inválido/expirado

- **WHEN** `POST /api/invitations/accept` con token inválido, expirado o ya usado
- **THEN** el server responde `400` con `{ error: "Invitación inválida o expirada" }`
