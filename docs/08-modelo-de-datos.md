# 08 — Modelo de datos

> Documento: `docs/08-modelo-de-datos.md`
>
> Formato y entidades del dominio. El **formato del modelo** ya está implementado en la Fase 1 en `client/src/lib/model/` (JSON propio, ver [AD-006](./09-decisiones-de-diseno.md)); las **entidades de persistencia** se concretan en la Fase 3 (CRUD de procesos).

## El modelo de proceso (el corazón de la app)

Un **proceso modelado** es, en esencia, un grafo dirigido:

- **Nodos** = pasos del proceso (tarea, decisión, inicio, fin, espera).
- **Conexiones (edges)** = transiciones entre pasos, que pueden llevar condiciones ("si aprobado → ...", "si no → ...").

### Formato del modelo (implementado en Fase 1)

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

- **Persistencia local primero (navegador) y server después**: ✅ implementado en la Fase 1 (`localStorage` + autoguardado en `client/src/hooks/useProcessModel.ts`); la API de procesos (Fase 3) es la persistencia definitiva.
- **Motor de base de datos**: a definir (SQLite para empezar o Postgres si ya hay infra). Ver [AD-010](./09-decisiones-de-diseno.md).
- **¿El usuario es persona o rol?**: en la Fase 1 el responsable es texto libre (`assignee`), sin tabla de usuarios todavía.