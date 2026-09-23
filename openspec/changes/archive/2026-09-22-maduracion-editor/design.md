# Design

## Context

La Fase 1 dejó el editor con estado en `useProcessModel` (nodos/aristas de React Flow + autoguardado en `localStorage`), serialización `modelo ⇄ React Flow` en `client/src/lib/model/serialize.ts` (AD-011) y validación **de forma** del modelo (`validateProcessModel`). La Fase 2 suma validación **semántica**, deshacer/rehacer y exportación de imagen sin tocar `server/`. Ver proposal.md (motivación) y el delta de specs (requisitos).

## Goals / Non-Goals

**Goals:**

- Validación en tiempo real, visible en la IU (errores y advertencias).
- Deshacer/rehacer de todos los tipos de cambio del editor, con botones y atajos.
- Exportar el diagrama como PNG y SVG con todos los nodos visibles.
- Mantener el co-residente estado de trabajo `{nodes, edges}` y el autoguardado existentes.

**Non-Goals:**

- Compatibilidad BPMN (sigue abierta, AD-006).
- Estado global con librería externa (se evalúa en AD-009 y se resuelve en esta fase).
- Exportar solo la región visible o con recorte interactivo.
- Cualquier cambio en `server/`.

## Decisions

### D1 — Historial de deshacer/rehacer con snapshots del estado de trabajo (sin librería)

Se implementa en `useProcessModel` un historial de **snapshots** del estado de trabajo `{nodes, edges}` (clonados con `structuredClone`) con `past` y `future` (`canUndo`/`canRedo`). Los checkpoints se crean en las **acciones discretas**: `addNode`, `onConnect`, eliminación (`onBeforeDelete` de React Flow, que corre antes de aplicar el borrado) y fin de arrastre de un nodo (`onNodeDragStop`). Las **ediciones de propiedades** se agrupan por **coalescing de pausa (~700 ms)** para no crear un checkpoint por cada tecla. `undo()`/`redo()` restauran el snapshot correspondiente con `setNodes`/`setEdges`.

- *Alternativas:* librerías como zundo o redux-undo → overhead y dependencias nuevas para dos stacks; contexto global (AD-009) → no aporta acá porque el historial vive junto al estado que ya posee el hook. Los atajos `Ctrl+Z`/`Ctrl+Shift+Z` se manejan en `App.tsx` ignorando eventos originados en inputs (para no pisar el deshacer nativo de los campos de texto).

### D2 — Validación semántica con función pura y panel en tiempo real

Nueva `client/src/lib/validation/validateProcess.ts` con `validateProcess(model) => ValidationIssue[]` (pura, sin dependencias): reglas con severidad `error`/`warning` — vacío, falta de Inicio, falta de Fin, más de un Inicio (warning), nodos sin conexión (warning), nodos no alcanzables desde un Inicio (error) y nodos que no llegan a un Fin (error); alcanzabilidad con recorrido de grafo (DFS) sobre las aristas. La UI deriva los issues con `useMemo` en `App.tsx` ante cada cambio de `model` (tiempo real, sin botón). Un nuevo `ValidationPanel` en la columna derecha (debajo de propiedades) los agrupa por severidad.

- *Alternativa:* validar por evento de botón → peor UX y fuera del requisito de "tiempo real".

### D3 — Exportación de imagen con `html-to-image` sobre el viewport

React Flow v12 **removió** `toPng`/`toSvg` del paquete core, y no existe un paquete oficial publicado de reemplazo (verificado en npm). Se usa `html-to-image` (estándar de la comunidad para React Flow): se exporta el elemento `.react-flow__viewport` (que contiene nodos y aristas con sus estilos reales) con `getNodesBounds` + `getViewportForBounds` para encuadrar **todos** los nodos a una imagen de tamaño fijo (fondos blanco). Los botones viven en `Toolbar`; para que la toolbar acceda a la instancia de React Flow, el `ReactFlowProvider` sube de `Canvas` a `App.tsx` (la instancia y el DOM se obtienen con `useReactFlow` + `useStoreApi().getState().domNode`).

- *Alternativas:* `@xyflow/tools` (no existe en npm, 404); exportación SVG manual (no incluiría el estilo real de los nodos custom); `toPng` de v11 (no disponible). Riesgo aceptado: `html-to-image` clona el DOM (costo puntual al exportar; no corre en el render normal).

### D4 — AD-009 resuelto: estado local con hooks (sin librería global)

Tras la complejidad real de la Fase 2 (historial, selección, validación), la conclusión es que el estado local con hooks en `App` + `useProcessModel` resuelve sin librería global: no hay estado compartido entre rutas/features (la app tiene una sola vista por ahora). Se actualiza el ADR y se agregan **AD-012** (historial de snapshots del estado de trabajo) y **AD-013** (exportación de imagen con `html-to-image`).

## Risks / Trade-offs

- [`html-to-image` depende de clonar el DOM y serializar estilos] → Mitigación: solo corre al exportar; canvas pequeño (editor personal); se encuadra con `getViewportForBounds`, no se exporta el viewport completo del navegador.
- [Eliminación con `onBeforeDelete` depende de un detalle de React Flow] → Mitigación: se toma el snapshot antes de devolver `true` (permitir borrado); se verifican manualmente los tres caminos (tecla Supr, botón, corte).
- [Coalescing por pausa puede unir ediciones rápidas distintas] → Consecuencia aceptada: un solo checkpoint por ráfaga de escritura; el deshacer vuelve al valor previo a la ráfaga.
- [Snapshots con `structuredClone` duplican el grafo en memoria] → Tamaño del modelo acotado (pocos cientos de nodos); listas `past`/`future` acotadas por uso real.

## Migration Plan

No aplica: no hay cambio de esquema de persistencia ni de formato de modelo (el `ProcessModel` y el autoguardado en `localStorage` quedan iguales).

## Open Questions

Ninguna: las decisiones que podrían cambiar specs (formato de exportación, alcance de la validación) están resueltas en las specs.