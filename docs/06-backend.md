# 06 — Backend

> Documento: `docs/06-backend.md`

## Stack

| Herramienta | Versión | Rol |
| --- | --- | --- |
| Node.js | 25.x (requiere 20+) | Runtime |
| Express | 5.x | Framework HTTP |
| TypeScript | 6.x | Tipado estático |
| tsx | 4.x | Dev server con hot reload |
| oxlint | 1.x | Lint |

## Qué hay hoy (Fase 0)

```
server/src/
├── index.ts          → Entry point: app.listen(PORT)
├── app.ts            → Config de Express (CORS, JSON, rutas, 404)
└── routes/
    └── health.ts     → GET /api/health
```

### Por qué `app.ts` y `index.ts` separados

- `app.ts` exporta la app **sin** llamar a `listen()`.
- Eso permite escribir tests de integración (p. ej. con `supertest`) sin ocupar un puerto real.
- `index.ts` es el único lugar con `listen()`.

## Estructura futura (a medida que crezcan los dominios)

```
server/src/
├── index.ts              → Entry point
├── app.ts                → Config de Express
├── routes/               → Definición de endpoints por dominio
│   ├── health.ts
│   └── processes.ts      → CRUD de procesos (Fase 3)
├── controllers/          → Handlers de los endpoints (usan services)
├── services/             → Lógica de negocio (no sabe de HTTP)
├── models/               → Capa de datos / persistencia
└── middleware/           → Validación, manejo de errores, auth (cuando aplique)
```

## Convenciones

- **ESM puro**: `"type": "module"` en `package.json`; imports relativos con extensión `.js` (p. ej. `import { app } from "./app.js"`), que tsx resuelve a `.ts` en dev y Node a `.js` en el build.
- **Montar rutas bajo `/api/<dominio>`** en `app.ts`.
- Respuestas JSON consistentes: `{ "error": "..." }` para errores, recursos directos para éxito (ver [07 — API](./07-api.md)).
- Tipos del dominio compartidos con el frontend (ver [08 — Modelo de datos](./08-modelo-de-datos.md)).

## Variables de entorno

| Variable | Default | Descripción |
| --- | --- | --- |
| `PORT` | `4000` | Puerto de la API |

Copiar `server/.env.example` a `server/.env` para personalizarlas.

## Cómo agregar una ruta nueva (receta)

1. Crear `src/routes/<dominio>.ts` con un `Router` de Express.
2. Exportar el router y montarlo en `app.ts`: `app.use("/api/<dominio>", router)`.
3. Documentar el endpoint en [07 — API](./07-api.md).
4. Correr `npm run lint` y `npm run typecheck` desde `server/`.