# Proposal

## Why

La Fase 1 entregó un editor funcional (dibujar nodos, conectarlos, guardar local), pero sin garantías de calidad del modelo ni herramientas de edición cómodas: no hay forma de saber si un proceso es válido/completo, un error de edición no se puede deshacer, y el único formato de salida es JSON. Para que la herramienta sirva en uso real hay que poder **validar**, **corregir errores** y **compartir el resultado como imagen**.

## What Changes

- **Validación del modelo en tiempo real**: el editor detecta automáticamente problemas del proceso (vacío, falta de inicio/fin, múltiples inicios, nodos sin conexión, nodos no alcanzables desde un inicio o que no llegan a un fin) y los muestra en un panel con errores y advertencias.
- **Deshacer/rehacer**: historial de cambios del modelo (agregar/eliminar nodos y aristas, mover, editar propiedades) con botones en la barra de herramientas y atajos `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Exportar imagen del diagrama**: descarga del proceso como **PNG** y como **SVG** (todos los nodos y aristas).
- **Polish del canvas**: minimapa con colores por tipo de nodo y snap-to-grid prolijo.
- **Evaluar AD-009** (estado global) con la complejidad real de esta fase.

## Capabilities

### New Capabilities

- Ninguna: la funcionalidad extiende el editor existente.

### Modified Capabilities

- `editor-visual`: se agregan requisitos de validación en tiempo real, deshacer/rehacer y exportación de imagen del diagrama.

## Impact

- **`client/`**:
  - Nueva dependencia: `html-to-image` (exportación de imagen sobre el DOM del viewport; React Flow v12 ya no provee `toPng`/`toSvg` en el paquete core).
  - `src/hooks/useProcessModel.ts`: historial de snapshots `{nodes, edges}` (deshacer/rehacer).
  - Nueva `src/lib/validation/` con la validación del modelo (función pura).
  - `src/features/editor/`: `Toolbar` con botones Deshacer/Rehacer y Exportar PNG/SVG; nuevo `ValidationPanel` en la columna derecha; `Canvas` con `onBeforeDelete`/`onNodeDragStop` y minimapa con colores.
  - `src/App.tsx`: `ReactFlowProvider` sube del `Canvas` a la app para que la toolbar acceda a la instancia de React Flow (necesario para exportar imagen).
- **`server/`**: sin cambios (la persistencia en server es de la Fase 3).
- **Documentación**: al completar el cambio, actualizar `docs/05-frontend.md`, `docs/09-decisiones-de-diseno.md` (AD-009 evaluado; AD-012 historial de snapshots; AD-013 exportación con `html-to-image`) y `docs/10-roadmap.md` (Fase 2 ✅).