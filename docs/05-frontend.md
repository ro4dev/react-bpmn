# 05 — Frontend

> Documento: `docs/05-frontend.md`

## Stack

| Herramienta | Versión | Rol |
| --- | --- | --- |
| React | 19.x | UI |
| Vite | 8.x | Build y dev server |
| TypeScript | 6.x | Tipado estático |
| oxlint | 1.x | Lint (plugins react, typescript, oxc) |
| React Flow (`@xyflow/react`) | — | **Planeado** (Fase 1): canvas del editor |

## Qué hay hoy (Fase 0)

- `src/App.tsx` — placeholder: título + aviso de que el editor viene en la Fase 1.
- `src/main.tsx` — bootstrap con `createRoot` y `StrictMode`.
- Config de Vite con **proxy** de `/api` → `localhost:4000`.

## Estructura planeada de `src/`

Se irá armando en las próximas fases:

```
src/
├── main.tsx               → Bootstrap
├── App.tsx                → Layout raíz (toolbar + editor + panels)
├── features/
│   ├── editor/
│   │   ├── Palette.tsx        → Lista de elementos arrastrables
│   │   ├── Canvas.tsx         → Lienzo (React Flow)
│   │   ├── PropertiesPanel.tsx→ Edita el nodo/conexión seleccionado
│   │   └── Toolbar.tsx        → Guardar, exportar/importar, zoom, deshacer
│   ├── processes/
│   │   └── ProcessList.tsx    → Listado de procesos guardados (Fase 3)
│   └── ...
├── components/            → UI genérica (botones, inputs, modales)
├── hooks/                 → Hooks personalizados
├── lib/
│   ├── model/             → Tipos y formato del modelo de proceso
│   └── validation/        → Validación de procesos
└── api/                   → Cliente HTTP a la API del server
```

## Decisiones de frontend

1. **Editor con React Flow** (`@xyflow/react`): es la librería de canvas de nodos más usada en el ecosistema React, ideal para un modelador. Se instala en la Fase 1 (ver [AD-005](./09-decisiones-de-diseno.md)).
2. **Tipado estricto** del modelo de proceso compartido entre frontend y backend (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).
3. **Sin librería de estado global todavía** — se evalúa según crezca la app (opciones: Zustand, Jotai, Context de React). Ver [AD-009](./09-decisiones-de-diseno.md).
4. **Componentes por features** — el editor es una feature autocontenida.

## Convenciones de código

- TypeScript estricto (`tsconfig.app.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- Lint con oxlint (rules de hooks y de exports en `.oxlintrc.json`).
- Componentes en PascalCase, hooks con prefijo `use`, utilidades en camelCase.
- Formato de archivos: imports primero, luego componentes, luego estilos (se sigue el orden del template).
- **Regla de documentación:** cualquier componente o utilidad nueva con lógica no trivial recibe un comentario de bloque JSDoc en la cabecera, y las decisiones importantes se registran en [09 — Decisiones de diseño](./09-decisiones-de-diseno.md).

## Estado de la IU (a definir en Fase 1)

- Paleta de elementos: Inicio, Fin, Tarea, Decisión, Espera (a confirmar con el usuario).
- Zoom, minimapa y grid en el canvas (vienen con React Flow).
- Guardado inicial en el navegador (localStorage) hasta que exista la API de persistencia (Fase 3).