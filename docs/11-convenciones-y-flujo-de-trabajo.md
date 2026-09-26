# 11 — Convenciones y flujo de trabajo

> Documento: `docs/11-convenciones-y-flujo-de-trabajo.md`

## Documentación (regla de oro del proyecto)

1. **Todo lo relevante se documenta en `.md`** dentro de `docs/`.
2. **Cada cambio** de estructura, API, modelo de datos o arquitectura actualiza el doc correspondiente **en el mismo PR/commit de trabajo**.
3. **Nada se da por sabido**: si una decisión nueva se toma en una conversación o durante el desarrollo, se registra como ADR en [09 — Decisiones de diseño](./09-decisiones-de-diseno.md).
4. Los archivos `.ts/.tsx` con lógica no trivial llevan un **comentario de bloque JSDoc** en la cabecera explicando su propósito.
5. Los endpoints nuevos se documentan en [07 — API](./07-api.md) al mismo tiempo que se implementan.

## Git

### Ramas

| Rama | Uso |
| --- | --- |
| `main` | Siempre estable; solo llega lo revisado |
| `feature/<descripcion>` | Trabajo nuevo (ej: `feature/editor-canvas`) |
| `fix/<descripcion>` | Correcciones |

Regla: **no commitear directo a `main`**. Flujo: rama feature → revisión → merge a `main`.

### Commits

- Mensajes claros en español (o inglés si se prefiere, pero **consistente**).
- Formato sugerido: `verb + qué` — ej: `feat: agregar canvas del editor`, `docs: documentar endpoints de procesos`.
- Prefijos sugeridos: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`.
- **No se commitea sin pedido explícito del usuario** (regla del workspace).

### Lo que NO se sube a git

`node_modules/`, `dist/`, `.env*`, logs (cubierto por `.gitignore` raíz).

## Código

- **TypeScript estricto** en client y server.
- **Lint obligatorio antes de dar por terminado un cambio**: `npm run lint` (0 errores).
- **Typecheck**: `npm run typecheck` antes de mergear.
- Nombres: componentes `PascalCase.tsx`, hooks `useX.ts`, utilidades `camelCase.ts`.
- Respuestas de la API siempre JSON; errores con `{ "error": "..." }`.
- No committed secrets: si aparece una API key, va a `.env` (y el ejemplo a `.env.example`).

## Proceso de cambio tipo

1. Crear rama `feature/<descripcion>`.
2. Implementar.
3. Correr `lint` (+ `typecheck` si toca tipos).
4. Correr `npm test` (server + diff + **browser**).
5. Actualizar documentación (docs/ + ADR si aplica).
6. Mostrar el cambio al usuario para revisión (no commitear sin OK).

## Herramientas

| Tarea | Herramienta |
| --- | --- |
| Editor visual | React Flow (`@xyflow/react`, Fase 1) |
| Lint | oxlint |
| Format | Prettier (a agregar si el usuario lo quiere) — hoy se mantiene el formato del template |
| Tests de lógica | `node:test` + `--experimental-strip-types` (sin framework) |
| Tests de API | `node:test` contra la app real con DB temporal |
| Tests de browser | Playwright con el Chrome del sistema (`npm run test:ui`) |

## Tests de browser (por qué existen)

`npm run test:ui` levanta la app en un Chrome real y verifica los flujos que las
suites de API **no pueden** ver: que la sesión llegue, que no salte el redirect a
`/login`, que el historial muestre los autores. Ya pagaron por esa cobertura: el
login funcionaba contra la API pero en el browser el refresh con rotación de
token borraba la sesión y volvía a `/login` sin mostrar error (ver
[03 — Guía de setup](./03-guia-de-setup.md)).

La segunda paga fue encontrar que **Playwright levanta los `webServer` antes del
`globalSetup`**: la API abría el archivo de la base de la corrida anterior y el
seed lo borraba después, así que los tests leían data vieja (el catálogo de 2
procesos cuando el código ya tenía 100) y fallaban por el motivo equivocado. Por
eso la base se siembra en un paso previo (`pretest:ui`) y el `globalSetup` solo
verifica que la API esté sirviendo esa base. Es la clase de error que más tiempo
cuesta cuando parece un bug de la app: si un test de browser falla con un dato
raro, sospechá primero de la base.