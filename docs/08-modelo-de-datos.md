# 08 — Modelo de datos

> Documento: `docs/08-modelo-de-datos.md`
>
> Entidades del dominio y su forma. **Es un borrador de trabajo** que se concreta cuando haya persistencia (Fase 3). Se define primero la estructura del modelo de proceso, porque de ahí derivan las entidades.

## El modelo de proceso (el corazón de la app)

Un **proceso modelado** es, en esencia, un grafo dirigido:

- **Nodos** = pasos del proceso (tarea, decisión, inicio, fin, espera).
- **Conexiones (edges)** = transiciones entre pasos, que pueden llevar condiciones ("si aprobado → ...", "si no → ...").

### Formato del modelo (borrador)

```typescript
// Modelo de proceso (compartido entre frontend y backend)
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
  | "wait";      // espera/espera de aprobación  [a confirmar]

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

> El formato final depende de [AD-006](./09-decisiones-de-diseno.md): BPMN estándar (`bpmn-js`) o formato propio simplificado (React Flow + JSON propio). La estructura de arriba es la del formato propio.

## Entidades de persistencia (planeadas, Fase 3)

| Entidad | Campos | Notas |
| --- | --- | --- |
| `Process` | `id`, `title`, `description`, `model`, `version`, `status`, `createdAt`, `updatedAt` | El proceso y su modelo actual |
| `ProcessVersion` | `id`, `processId`, `version`, `model`, `createdAt`, `author` | Historial de versiones (cada guardado publica una versión) |
| `User` | `id`, `name`, `email`, `role` | Usuarios del sistema (pendiente definir autenticación) |

### Relaciones

```
User 1────* ProcessVersion
Process 1───* ProcessVersion
Process 1───1 model (embebido en Process o en la última ProcessVersion)
```

## Estados de un proceso

| Estado | Significado |
| --- | --- |
| `draft` | Borrador, no publicado |
| `published` | Versión publicada y consultable |
| `archived` | Dado de baja (informativo) |

## Decisiones abiertas

- **Persistencia local primero (navegador) y server después**: el guardado de la Fase 1 será en `localStorage`/IndexedDB; la API de procesos (Fase 3) es la persistencia definitiva.
- **Motor de base de datos**: a definir (SQLite para empezar o Postgres si ya hay infra). Ver [AD-010](./09-decisiones-de-diseno.md).
- **¿El usuario es persona o rol?**: en la Fase 1 el responsable es texto libre (`assignee`), sin tabla de usuarios todavía.