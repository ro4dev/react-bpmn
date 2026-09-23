# react-bpmn

> Modelador web de procesos de negocio.

Herramienta web para modelar procesos internos de una organización — contratación de personal, validación de solicitudes, flujos de aprobación, etc. — de forma **visual**, pensada para que tanto **personas de negocio** como **analistas técnicos** puedan dibujar, documentar y (a futuro) ejecutar sus procesos.

---

## Índice de documentación

Toda la documentación del proyecto vive en [`docs/`](./docs/), en formato `.md`.

| Doc | Contenido |
| --- | --- |
| [01 — Visión y alcance](./docs/01-vision-y-alcance.md) | Qué es, para quién, qué resuelve, qué está fuera de alcance |
| [02 — Arquitectura](./docs/02-arquitectura.md) | Diseño de alto nivel, componentes, flujo de peticiones |
| [03 — Guía de setup](./docs/03-guia-de-setup.md) | Requisitos, instalación y comandos |
| [04 — Estructura del proyecto](./docs/04-estructura-del-proyecto.md) | Árbol de carpetas y archivos, uno por uno |
| [05 — Frontend](./docs/05-frontend.md) | Stack, convenciones y plan del cliente web |
| [06 — Backend](./docs/06-backend.md) | Stack, convenciones y plan de la API |
| [07 — API](./docs/07-api.md) | Endpoints actuales y planeados, con ejemplos |
| [08 — Modelo de datos](./docs/08-modelo-de-datos.md) | Entidades planeadas del dominio |
| [09 — Decisiones de diseño](./docs/09-decisiones-de-diseno.md) | ADRs: por qué se eligió cada cosa |
| [10 — Roadmap](./docs/10-roadmap.md) | Fases de desarrollo y estado actual |
| [11 — Convenciones y flujo de trabajo](./docs/11-convenciones-y-flujo-de-trabajo.md) | Git, código, documentación |

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite 8 + TypeScript |
| Modelador visual | React Flow (`@xyflow/react`) — planeado, no instalado aún |
| Backend | Node + Express 5 + TypeScript |
| Lint | oxlint |
| Dev | `concurrently` (levanta client y server juntos) |

## Estructura rápida

```
react-bpmn/
├── client/   → Frontend (Vite + React + TS)
├── server/   → API (Express + TS)
└── docs/     → Documentación (.md)
```

## Arranque rápido

Requisitos: **Node 20+** (probado con Node 25) y npm 10+.

```bash
npm install --prefix client
npm install --prefix server
npm install
npm run dev
```

- Frontend → http://localhost:5173
- API → http://localhost:4000 (probá con `GET /api/health`)

Comandos completos en [03 — Guía de setup](./docs/03-guia-de-setup.md).

---

## Estado del proyecto

**Fase actual: 0 — Scaffold** ✅

- Repos local: `~/Projects/react-bpmn` · remoto: [`github.com/ro4dev/react-bpmn`](https://github.com/ro4dev/react-bpmn)
- Frontend y backend levantados y verificados (build + lint + smoke test de `/api/health`).
- Sin funcionalidad de modelado aún: el editor arranca en la Fase 1 (ver [Roadmap](./docs/10-roadmap.md)).