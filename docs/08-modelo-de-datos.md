# 08 — Modelo de datos

> Documento: `docs/08-modelo-de-datos.md`
>
> Formato y entidades del dominio. El **formato del modelo** ya está implementado en la Fase 1 en `client/src/lib/model/` (JSON propio, ver [AD-006](./09-decisiones-de-diseno.md)); las **entidades de persistencia** están implementadas desde la Fase 3 (CRUD + versionado) y la Fase 4 (usuarios, permisos, invitaciones).

## El modelo de proceso (el corazón de la app)

Un **proceso modelado** es, en esencia, un grafo dirigido:

- **Nodos** = pasos del proceso (tarea, decisión, inicio, fin, espera).
- **Conexiones (edges)** = transiciones entre pasos, que pueden llevar condiciones ("si aprobado → ...", "si no → ...").

### Formato del modelo (implementado en Fase 1, compartido en Fase 3 vía `shared/`)

```typescript
// Modelo de proceso (compartido entre frontend y backend — fuente de verdad en `shared/src/model/types.ts`)
interface ProcessModel {
  version: 1;                        // versión del *formato*, no del proceso
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

type ProcessNodeKind =
  | "start"      // inicio del flujo
  | "end"        // fin del flujo
  | "task"       // tarea/paso (con responsable y descripción)
  | "decision"   // decisión sí/no (con condición)
  | "wait";      // espera/espera de aprobación  [fuera de la paleta Fase 1]

interface ProcessNode {
  id: string;        // único dentro del modelo
  kind: ProcessNodeKind;
  label: string;     // nombre del paso
  position: { x: number; y: number };  // coordenadas en el canvas
  props: {
    description?: string;
    assignee?: string;     // responsable (rol o persona)
    condition?: string;    // para nodos decision
  };
}

interface ProcessEdge {
  id: string;
  source: string;    // id del nodo origen
  target: string;    // id del nodo destino
  label?: string;    // p. ej. "Sí" / "No"
}
```

> La Fase 1 implementó la paleta mínima **Inicio, Fin, Tarea, Decisión** (confirmada con el usuario); `wait` queda fuera por ahora. El formato final del modelo sigue condicionado por [AD-006](./09-decisiones-de-diseno.md): BPMN estándar (`bpmn-js`) o formato propio simplificado. Hoy está implementado el formato propio (ver la serialización en `client/src/lib/model/`).

## Entidades de persistencia (✅ implementadas Fase 3 + 4)

Motor: SQLite nativo (`node:sqlite` + `DatabaseSync`) en modo **WAL**. Esquema en `server/src/db/schema.ts` (idempotente: `CREATE TABLE IF NOT EXISTS`), creado en el constructor de los stores.

| Entidad | Tabla | Campos | Notas |
| --- | --- | --- | --- |
| `Process` | `Process` | `id` (PK), `name`, `currentVersion`, `ownerId` (FK), `createdAt`, `updatedAt` | Metadatos + versión actual + dueño |
| `ProcessVersion` | `ProcessVersion` | `id` (PK auto), `processId` (FK), `version`, `model` (JSON), `comment`, `createdAt` | Versión inmutable por guardado; UNIQUE(processId, version) |
| `User` | `User` | `id` (PK), `email` (UNIQUE), `passwordHash`, `name`, `avatar`, `createdAt` | Usuarios de la Fase 4 |
| `ProcessCollaborator` | `ProcessCollaborator` | `processId` + `userId` (PK compuesta), `role`, `invitedAt` | Roles `editor` / `viewer` |
| `Invitation` | `Invitation` | `id` (PK), `email`, `processId` (FK), `role`, `token`, `expiresAt`, `createdAt` | Invitación para emails sin cuenta |
| `RefreshToken` | `RefreshToken` | `id` (PK), `userId` (FK), `tokenHash`, `expiresAt`, `createdAt` | Sesiones; se rota en cada refresh |

### Relaciones

```
User 1───* Process          (ownerId, ON DELETE SET NULL)
User *───* Process          (vía ProcessCollaborator: editor / viewer)
Process 1───* ProcessVersion (ON DELETE CASCADE)
Process 1───* Invitation     (ON DELETE CASCADE)
User    1───* RefreshToken   (ON DELETE CASCADE)
```

`Process.ownerId` es la **fuente de verdad** del rol `owner` (no hay fila en `ProcessCollaborator` para el dueño), y `roleOf()` lo prioriza sobre cualquier fila de colaboradores.

Índices:
- `idx_process_updatedAt` (para listado ordenado)
- `idx_process_version_processId` (para listado de versiones DESC)
- `idx_process_ownerId` (para "mis procesos")
- `idx_collaborator_userId` (para "compartidos conmigo")
- `idx_refresh_token_userId` (logout en todos los dispositivos)

### Estados derivados (calculados en API, no almacenados)

| Status | Significado |
| --- | --- |
| `válido` | Pasa validación semántica (tiene Inicio/Fin, alcanzable, etc.) |
| `con-advertencias` | Pasa validación pero tiene warnings (p. ej. nodos aislados, múltiples Inicio) |
| `con-errores` | Falla validación (p. ej. falta Inicio/Fin) |
| `vacío` | Sin nodos |

## Estados de un proceso (UI)

| Estado | Significado |
| --- | --- |
| `draft` | Borrador, trabajo en curso (localStorage, aún no guardado en el server) |
| `saved` | Guardado en server (tiene `id` + versión) |
| `archived` | Dado de baja (informativo) |

## Decisiones adoptadas (Fase 4)

- **Autenticación**: ✅ **email/password + JWT** (bcrypt 12 rondas, access token 15 min, refresh token opaco 7 días en cookie httpOnly, rotado en cada refresh). Ver [AD-017](./09-decisiones-de-diseno.md).
- **Autorización**: ✅ **por proceso**, con `ProcessCollaborator` y roles `owner` / `editor` / `viewer` (sin workspaces). Ver [AD-018](./09-decisiones-de-diseno.md).
- **Invitaciones**: ✅ **token JWT firmado** de 7 días + tabla `Invitation`; email simulado (log en consola), sin SMTP. Ver [AD-019](./09-decisiones-de-diseno.md).
- **Tokens opacos**: ✅ hasheados con **SHA-256** para lookup directo por índice; bcrypt queda solo para passwords. Ver [AD-021](./09-decisiones-de-diseno.md).
- **Migración `ownerId`**: la tabla `Process` de la Fase 3 no tenía dueño. `schema.ts` la agrega de forma idempotente leyendo `PRAGMA table_info`, así que una base existente se actualiza al arrancar. Los procesos previos quedan **sin acceso** hasta que se les asigne un `ownerId`.