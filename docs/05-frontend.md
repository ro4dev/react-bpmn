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
| React Router | 7.x | Rutas y rutas protegidas (Fase 4) |

## Qué hay hoy (Fase 4)

- Editor funcional: canvas React Flow + paleta de elementos, drag-and-drop de nodos, conexiones entre ellos y panel de propiedades.
- Paleta mínima **confirmada**: Inicio, Fin, Tarea, Decisión.
- Persistencia local (`localStorage`) con autoguardado; exportar/importar el modelo como JSON.
- Listado de procesos con búsqueda y filtro Míos / Compartidos / Todos, con badge de rol.
- Autenticación: páginas de login/registro/perfil, header global con menú de usuario, rutas protegidas (`ProtectedRoute`) y públicas (`PublicRoute`).
- Compartir: modal de colaboradores con invitaciones por email y pendientes.
- Historial: panel lateral con diff entre versiones y restauración.
- Dev en `localhost:5173` con proxy `/api` a la API en 4000.

## Estructura de `src/` (Fase 4)

```
src/
├── main.tsx               → Bootstrap (monta App)
├── App.tsx                → Router + rutas protegidas + header global + workspace (listado | editor | historial)
├── context/
│   └── AuthContext.tsx    → Sesión global: user, login/register/logout, recuperación por refresh
├── pages/
│   ├── Login.tsx          → Inicio de sesión
│   ├── Register.tsx       → Alta de usuario
│   ├── Profile.tsx        → Datos del usuario
│   ├── Invitations.tsx    → Invitaciones pendientes (acepta ?token=)
│   └── AuthPages.css      → Estilos de las páginas de auth
├── features/
│   ├── editor/            → Canvas, Palette, PropertiesPanel, ValidationPanel, Toolbar, nodes
│   └── processes/
│       ├── ProcessList.tsx     → Tabla de procesos + búsqueda + filtro por alcance
│       ├── ShareModal.tsx      → Colaboradores e invitaciones
│       ├── VersionHistory.tsx  → Panel lateral de versiones con diff y restauración
│       └── *.css
├── hooks/
│   └── useProcessModel.ts  → Estado del editor + historial deshacer/rehacer + autoguardado
└── lib/
    ├── api/
    │   ├── http.ts         → fetch con Authorization, refresh automático ante 401
    │   ├── session.ts      → Access token en memoria + aviso de sesión expirada
    │   ├── processes.ts    → Cliente de /api/processes (CRUD, versiones, colaboradores)
    │   └── auth.ts         → Cliente de /api/auth e invitaciones
    ├── model/
    │   ├── types.ts            → ProcessModel, ProcessNode, ProcessEdge
    │   ├── palette.ts          → Paleta mínima y constantes de drag-and-drop
    │   ├── serialize.ts        → Serialización modelo ⇄ React Flow + validación runtime
    │   └── diff.ts             → Diff semántico de modelos (Fase 4)
    ├── validation/
    │   └── validateProcess.ts  → Validación pura del proceso (errores/advertencias, AD-012)
    └── exportImage.ts          → Exportación PNG/SVG (Fase 2, AD-013)
```

Pendiente para fases siguientes: `components/` (UI genérica) y el motor de ejecución (Fase 5).

## Decisiones de frontend

1. **Editor con React Flow** (`@xyflow/react`, v12): es la librería de canvas de nodos más usada en el ecosistema React, ideal para un modelador. Instalada y configurada en la Fase 1 (ver [AD-005](./09-decisiones-de-diseno.md)).
2. **Tipado estricto** del modelo de proceso compartido entre frontend y backend (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).
3. **Sin librería de estado global** — el estado del editor vive en `useProcessModel` y la sesión en un `Context` de React (`AuthContext`). No se agregan Zustand/Jotai: no hay estado compartido que lo justifique. Ver [AD-009](./09-decisiones-de-diseno.md).
4. **Componentes por features** — el editor y la gestión de procesos son features autocontenidas.
5. **El access token solo en memoria** — nunca en `localStorage`; el refresh viaja en cookie httpOnly y `apiFetch` renueva solo ante un 401 (ver [AD-017](./09-decisiones-de-diseno.md)).
6. **Listado y editor comparten una sola instancia de `Workspace`** (`path="*"` con redirección interna): si fueran dos `<Route>` distintas, React desmontaría el componente al cambiar de ruta y se perdería el modelo que está en memoria.

## Convenciones de código

- TypeScript estricto (`tsconfig.app.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`).
- Lint con oxlint (rules de hooks y de exports en `.oxlintrc.json`).
- Componentes en PascalCase, hooks con prefijo `use`, utilidades en camelCase.
- Formato de archivos: imports primero, luego componentes, luego estilos (se sigue el orden del template).
- **Regla de documentación:** cualquier componente o utilidad nueva con lógica no trivial recibe un comentario de bloque JSDoc en la cabecera, y las decisiones importantes se registran en [09 — Decisiones de diseño](./09-decisiones-de-diseno.md).

## Estado de la IU (Fase 4)

- Paleta de elementos **confirmada**: Inicio, Fin, Tarea, Decisión.
- Zoom, minimapa y grid en el canvas (vienen con React Flow: `Controls`, `MiniMap`, `Background`).
- Guardado local en el navegador (`localStorage`, autoguardado debounced) como borrador, y la API como persistencia definitiva. El estado de trabajo del editor es el `{nodes, edges}` de React Flow; el `ProcessModel` se usa para persistir/exportar/importar (ver [AD-011](./09-decisiones-de-diseno.md)).
- Un `viewer` ve el proceso con el panel de propiedades en solo lectura y un aviso explícito; el badge de rol aparece en la toolbar.