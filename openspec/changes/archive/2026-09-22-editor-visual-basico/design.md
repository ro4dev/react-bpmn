# Design

## Context

El client está en el scaffold de la Fase 0 (`client/src/` solo tiene `App.tsx` placeholder, `main.tsx` y CSS base). No hay specs previas ni infraestructura de editor. Las decisiones previas que condicionan este diseño (detalle en [docs/09 — Decisiones de diseño](./docs/09-decisiones-de-diseno.md)):

- **AD-005**: el editor se construye sobre React Flow (`@xyflow/react`), con serialización `{nodes, edges}` compatibile con el borrador de modelo de [docs/08 — Modelo de datos](./docs/08-modelo-de-datos.md).
- **AD-006**: se arranca con el formato propio simplificado (JSON React Flow); el BPMN estándar se evalúa antes de la persistencia definitiva (Fase 3).
- **AD-009**: sin librería de estado global por ahora; se evalúan Zustand/Jotai/Context en la Fase 2.

La motivación del cambio está en `proposal.md`; los requisitos de comportamiento en `specs/editor-visual/spec.md`.

## Goals / Non-Goals

**Goals:**

- Montar el editor con la menor cantidad de piezas posible, delegando en React Flow (canvas, zoom, minimapa, grid, drag-and-drop y conexiones los provee la librería).
- Mantener el modelo de proceso como un JSON propio versionado (`ProcessModel`) que sea la única forma de persistir/exportar/importar, y derivar de él la representación visual.
- Estructura `src/features/editor/` autocontenida, tal como se planeó en `docs/05-frontend.md`.

**Non-Goals:**

- No hay persistencia en servidor ni CRUD de procesos (Fase 3) — `localStorage` es un stub local.
- No hay validación semántica del proceso (caminos, nodos huérfanos) ni deshacer/rehacer (Fase 2).
- No hay compatibilidad BPMN estándar (depende de AD-006).
- No hay autenticación ni multiusuario.

## Decisions

### D1 — Canvas con `@xyflow/react` (React Flow v12)

Se instala `@xyflow/react` en `client/` y se monta el componente `ReactFlow` con nodos custom por tipo (`nodeTypes`): círculo para Inicio/Fin, rectángulo para Tarea, rombo para Decisión.

- **Alternativas consideradas:** `bpmn-js` (descartado: schema BPMN, integración con React más débil y AD-006 lo deja en evaluación para más adelante) y SVG/DOM a mano (descartado: reinventar drag, conexiones, zoom y grid).
- **Por qué esta:** es la decisión ya tomada en AD-005, es la librería de nodos más usada del ecosistema React y cubre drag-and-drop, conexiones y viewport sin trabajo extra. Riesgo de compatibilidad con React 19: se verifica la versión instalada (v12+) al momento de la instalación.

### D2 — Modelo de proceso como fuente de verdad

Se definen en `src/lib/model/` los tipos del borrador de `docs/08-modelo-de-datos.md`:

- `ProcessModel { version: 1, nodes: ProcessNode[], edges: ProcessEdge[] }`.
- `ProcessNodeKind = "start" | "end" | "task" | "decision"` (sin `wait` por ahora; la paleta acordada es Inicio/Fin/Tarea/Decisión).
- `ProcessNode { id, kind, label, position, props { description?, assignee? } }` y `ProcessEdge { id, source, target, label? }`.

El estado de trabajo del editor es el estado `{nodes, edges}` de React Flow, con `kind` y `props` dentro de `node.data`; la serialización a `ProcessModel` ocurre al autoguardar, exportar e importar. Así el formato visual y el de persistencia quedan en un solo lugar.

- **Alternativa considerada:** guardar siempre el `ProcessModel` y derivar nodos/edges de React Flow de él en cada cambio (más "una sola fuente"). Se descarta por ahora: duplicaría la sincronización sin beneficio real en una fase sin colaboración ni versionado; se revisa en la Fase 2 con el estado global (AD-009).

### D3 — Persistencia local con autoguardado debounced

Hook `useProcessModel` que se suscribe a cambios del modelo, serializa el `ProcessModel` y lo escribe en `localStorage` con un debounce corto (~500 ms), bajo una clave única de la app (p. ej. `react-bpmn:process:current`). Al montar, restaura el último modelo guardado si existe.

- **Por qué debounce:** el drag y las conexiones disparan muchas actualizaciones seguidas; escribir en cada `onNodesChange`/`onEdgesChange` satura el storage y bloquea el hilo principal.

### D4 — Exportar/importar JSON con validación de forma

- **Exportar:** serializa el `ProcessModel` actual a JSON y dispara la descarga de un archivo (p. ej. `proceso.json`).
- **Importar:** `input[type=file]` → lee y parsea el JSON → valida la forma mínima (objeto con `nodes`/`edges`, ids consistentes) antes de reemplazar el estado. Si la validación falla, se muestra un mensaje de error y el modelo actual no se toca (requisito "Importar un JSON inválido").
- **Por qué validar en runtime:** el JSON es entrada de usuario; sin validación, datos malformados romperían el canvas silenciosamente.

### D5 — Componentes y estado

Estructura según `docs/05-frontend.md`:

- `src/features/editor/`: `Canvas.tsx` (React Flow + `nodeTypes`), `Palette.tsx` (lista arrastrable con los 4 tipos), `Toolbar.tsx` (guardar/exportar/importar), `PropertiesPanel.tsx` (formulario del nodo seleccionado: título, descripción, responsable).
- `src/App.tsx` pasa a ser el layout: `Toolbar` arriba, `Canvas` al centro y `PropertiesPanel` a la derecha.
- Estado local en el editor con `useNodesState`/`useEdgesState` + `selectedNodeId`; el panel edita vía callback que actualiza el nodo y su `data`. Sin store global (AD-009).

## Risks / Trade-offs

- **[Pérdida de datos por `localStorage`]** → Es un stub explícito hasta la Fase 3; el `ProcessModel` queda versionado (`version`) para migrar el almacenamiento sin romper modelos viejos, y el export JSON permite respaldo manual.
- **[JSON importado malformado rompe el canvas]** → Validación de forma en runtime (D4) antes de cargar; en caso de error, mensaje y modelo intacto.
- **[Incompatibilidad `@xyflow/react` con React 19]** → Se fija la versión v12+ verificada contra React 19 al instalar; si hubiera fricción, se pintea a la versión compatible.
- **[Autoguardado con escrituras frecuentes bloquea el hilo]** → Debounce de ~500 ms (D3) y escritura atómica del JSON serializado.

## Migration Plan

Cambio 100% frontend, sin API ni datos en server. Despliegue: commit + build estándar. Rollback: revert del commit. El formato de `localStorage` nace versionado (`ProcessModel.version`) para permitir migraciones futuras sin borrar datos del usuario.