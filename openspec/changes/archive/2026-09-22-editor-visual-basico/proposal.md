# Proposal

## Why

El proyecto terminó la Fase 0 (scaffold) y aún no permite modelar nada: el editor es la razón de ser de la herramienta. Esta Fase 1 habilita lo mínimo para que una persona pueda **dibujar un proceso de negocio en el navegador** — sin esto, la app no cumple su propósito.

## What Changes

- Instalar `@xyflow/react` (React Flow) en `client/` y montar el canvas del editor.
- Crear la feature `editor` con los componentes planeados: `Canvas` (lienzo React Flow), `Palette` (elementos arrastrables), `Toolbar` (guardar, exportar/importar) y `PropertiesPanel` (edición del nodo seleccionado).
- Paleta mínima de nodos — **confirmada con el usuario**: Inicio, Fin, Tarea y Decisión.
- Drag-and-drop de nodos de la paleta al canvas y conexión entre nodos (edges).
- Panel de propiedades para el nodo seleccionado: **título** (label), **descripción** y **responsable** (assignee).
- Guardado local en el navegador (`localStorage`) con autoguardado.
- Exportar e importar el modelo de proceso como **JSON** (formato propio del proyecto, ver `docs/08-modelo-de-datos.md`).

## Capabilities

### New Capabilities

- `editor-visual`: editor de procesos basado en React Flow — canvas, paleta, drag-and-drop, conexiones, panel de propiedades, persistencia local en el navegador y exportación/importación del modelo como JSON.

### Modified Capabilities

- Ninguna: es el primer cambio con specs (no existen specs previas en el proyecto).

## Impact

- **`client/`**:
  - Nueva dependencia: `@xyflow/react` (React Flow).
  - Nueva estructura `src/features/editor/` (`Canvas`, `Palette`, `Toolbar`, `PropertiesPanel`).
  - `src/App.tsx` pasa de placeholder a layout del editor (toolbar + canvas + panel de propiedades).
  - Nuevos tipos del modelo de proceso en `src/lib/model/` (nodos, edges, clases de nodo).
  - Persistencia local vía `localStorage` (stub hasta la API de procesos de la Fase 3).
- **`server/`**: sin cambios — la persistencia en servidor es de la Fase 3.
- **Documentación**: al completar el cambio, actualizar `docs/` según la convención del proyecto (`docs/10-roadmap.md`, `docs/05-frontend.md`, `docs/08-modelo-de-datos.md` si hace falta).
- **Formato de modelo**: `ProcessModel` / `ProcessNode` / `ProcessEdge` en JSON propio (decisión AD-006; el formato BPMN estándar queda fuera de alcance de esta fase).