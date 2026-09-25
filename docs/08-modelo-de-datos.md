# 08 — Modelo de datos

> Documento: `docs/08-modelo-de-datos.md`
>
> Formato y entidades del dominio. El **formato del modelo** ya está implementado en la Fase 1 en `client/src/lib/model/` (JSON propio, ver [AD-006](./09-decisiones-de-diseno.md)); las **entidades de persistencia** se concretan en la Fase 3 (CRUD de procesos + versionado).

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

## Entidades de persistencia (✅ implementadas Fase 3)

| Entidad | Tabla | Campos | Notas |
| --- | --- | --- | --- |
| `Process` | `Process` | `id` (PK), `name`, `currentVersion`, `createdAt`, `updatedAt` | Metadatos del proceso + versión actual |
| `ProcessVersion` | `ProcessVersion` | `id` (PK auto), `processId` (FK), `version`, `model` (JSON), `comment`, `createdAt` | Versión inmutable por guardado; UNIQUE(processId, version) |
| `User` | — | — | Pendiente (Fase 4 / AD-008) |

### Relaciones

```
Process 1───* ProcessVersion   (ON DELETE CASCADE)
```

Índices:
- `idx_process_updatedAt` (para listado ordenado)
- `idx_process_version_processId` (para listado de versiones DESC)

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
| `draft` | Borrador, trabajo en curso (localStorage) |
| `saved` | Guardado en server (tiene `id` + versión) |
| `archived` | Dado de baja (informativo) |

## Decisiones adoptadas (Fase 3)

- **Motor de base de datos**: ✅ **SQLite nativo** (`node:sqlite` + `DatabaseSync`). Ver [AD-010](./09-decisiones-de-diseno.md).
- **Versionado**: ✅ **Inmutable** (`ProcessVersion` por guardado, `Process.currentVersion` = última). Ver [AD-016](./09-decisiones-de-diseno.md).
- **Modelo compartido**: ✅ **`shared/`** con `ProcessModel` + `validateProcess` vía alias `@shared/*`. Ver [AD-015](./09-decisiones-de-diseno.md).
- **Persistencia local primero (navegador) y server después**: ✅ implementado en la Fase 1 (`localStorage` + autoguardado en `useProcessModel`); la API de procesos (Fase 3) es la persistencia definitiva y fuente de verdad para trabajo compartido.