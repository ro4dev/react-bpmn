# 05 — Frontend

> Documento: `docs/05-frontend.md`

## Stack

| Herramienta | Versión | Rol |
| --- | --- | --- |
| React | 19.x | UI |
| Vite | 8.x | Build y dev server |
| TypeScript | 6.x | Tipado estático |
| oxlint | 1.x | Lint (plugins react, typescript, oxc) |
| React Flow (`@xyflow/react`) | 12.x | Instalado (Fase 1): canvas del editor |

## Qué hay hoy (Fase 1)

- Editor funcional: canvas React Flow + paleta de elementos, drag-and-drop de nodos, conexiones entre ellos y panel de propiedades.
- Paleta mínima **confirmada**: Inicio, Fin, Tarea, Decisión.
- Persistencia local (`localStorage`) con autoguardado; exportar/importar el modelo como JSON.
- Sin API de procesos todavía (llega en la Fase 3); dev en `localhost:5173` con proxy `/api`.

## Estructura de `src/` (Fase 2)

```
src/
├── main.tsx               → Bootstrap (monta App)
├── App.tsx                → Workspace del editor (paleta | canvas | propiedades+validación) + atajos Ctrl+Z/Ctrl+Shift+Z
├── features/
│   └── editor/
│       ├── Canvas.tsx          → Lienzo (React Flow): drag-and-drop, conexiones, minimapa, grid
│       ├── Palette.tsx         → Lista de elementos arrastrables (Inicio, Fin, Tarea, Decisión)
│       ├── PropertiesPanel.tsx → Edita el nodo seleccionado
│       ├── ValidationPanel.tsx → Issues de validación en vivo (columna derecha)
│       ├── Toolbar.tsx         → Guardar, deshacer/rehacer, exportar PNG/SVG, exportar/importar JSON
│       ├── nodes.tsx           → Nodos custom (Inicio, Fin, Tarea, Decisión)
│       └── editor.css          → Estilos del editor
├── hooks/
│   └── useProcessModel.ts  → Estado del editor + historial deshacer/rehacer + autoguardado
└── lib/
    ├── model/
    │   ├── types.ts            → ProcessModel, ProcessNode, ProcessEdge
    │   ├── palette.ts          → Paleta mínima y constantes de drag-and-drop
    │   └── serialize.ts        → Serialización modelo ⇄ React Flow + validación runtime
    └── validation/
        └── validateProcess.ts  → Validación pura del proceso (errores/advertencias, AD-012)
```

Pendiente para fases siguientes: `components/` (UI genérica), `lib/export/` → ya resuelto en Fase 2 con `html-to-image` (AD-013), `api/` (cliente HTTP) y `features/processes/` (listado de procesos, Fase 3).

## Decisiones de frontend

1. **Editor con React Flow** (`@xyflow/react`, v12): es la librería de canvas de nodos más usada en el ecosistema React, ideal para un modelador. Instalada y configurada en la Fase 1 (ver [AD-005](./09-decisiones-de-diseno.md)).
2. **Tipado estricto** del modelo de proceso compartido entre frontend y backend (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).
3. **Sin librería de estado global todavía** — se evalúa según crezca la app (opciones: Zustand, Jotai, Context de React). Ver [AD-009](./09-decisiones-de-diseno.md).
4. **Componentes por features** — el editor es una feature autocontenida.

## Convenciones de código

- TypeScript estricto (`tsconfig.app.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- Lint con oxlint (rules de hooks y de exports en `.oxlintrc.json`).
- Componentes en PascalCase, hooks con prefijo `use`, utilidades en camelCase.
- Formato de archivos: imports primero, luego componentes, luego estilos (se sigue el orden del template).
- **Regla de documentación:** cualquier componente o utilidad nueva con lógica no trivial recibe un comentario de bloque JSDoc en la cabecera, y las decisiones importantes se registran en [09 — Decisiones de diseño](./09-decisiones-de-diseno.md).

## Estado de la IU (Fase 1)

- Paleta de elementos **confirmada**: Inicio, Fin, Tarea, Decisión.
- Zoom, minimapa y grid en el canvas (vienen con React Flow: `Controls`, `MiniMap`, `Background`).
- Guardado local en el navegador (`localStorage`, autoguardado debounced) hasta que exista la API de persistencia (Fase 3). El estado de trabajo del editor es el `{nodes, edges}` de React Flow; el `ProcessModel` se usa para persistir/exportar/importar (ver [AD-011](./09-decisiones-de-diseno.md)).