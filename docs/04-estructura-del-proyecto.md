# 04 — Estructura del proyecto

> Documento: `docs/04-estructura-del-proyecto.md`
>
> Documenta el árbol de carpetas **al cierre de la Fase 0** (scaffold). Se actualiza en cada fase que agregue o mueva archivos.

## Árbol completo

```
react-bpmn/
├── .gitignore                  → Ignora node_modules/, dist/, .env, logs, etc.
├── README.md                   → Puerta de entrada: qué es + índice de docs
├── package.json                → Scripts raíz: dev, build, lint (orquesta client+server)
├── docs/                       → Toda la documentación del proyecto (.md)
│   ├── 01-vision-y-alcance.md
│   ├── 02-arquitectura.md
│   ├── 03-guia-de-setup.md
│   ├── 04-estructura-del-proyecto.md   ← este archivo
│   ├── 05-frontend.md
│   ├── 06-backend.md
│   ├── 07-api.md
│   ├── 08-modelo-de-datos.md
│   ├── 09-decisiones-de-diseno.md
│   ├── 10-roadmap.md
│   └── 11-convenciones-y-flujo-de-trabajo.md
│
├── client/                     → Aplicación web (Vite + React + TS)
│   ├── .gitignore              → Ignora node_modules/, dist/ (generado por Vite)
│   ├── .oxlintrc.json          → Config de oxlint (plugins react, typescript, oxc)
│   ├── README.md               → Mini-guía del client (apunta a docs/)
│   ├── index.html              → HTML raíz, título: "react-bpmn — Modelador de procesos"
│   ├── package.json            → Dependencias y scripts del client
│   ├── public/
│   │   ├── favicon.svg         → Ícono del sitio
│   │   └── icons.svg           → Sprite de íconos (template Vite)
│   ├── src/
│   │   ├── App.tsx             → Componente raíz (placeholder del modelador)
│   │   ├── App.css             → Estilos de App.tsx
│   │   ├── index.css           → Estilos globales
│   │   └── main.tsx            → Bootstrap de React (createRoot + StrictMode)
│   ├── tsconfig.json           → Referencia a app + node configs
│   ├── tsconfig.app.json       → TS para código de la app (src/)
│   ├── tsconfig.node.json      → TS para tooling (vite.config.ts)
│   └── vite.config.ts          → Config de Vite + proxy /api → localhost:4000
│
└── server/                     → API REST (Express 5 + TS)
    ├── .env.example            → Variables de entorno documentadas (PORT)
    ├── package.json            → Dependencias y scripts del server
    ├── tsconfig.json           → TS para el server (ESM, outDir: dist)
    ├── src/
    │   ├── index.ts            → Entry point: levanta Express en PORT (4000)
    │   ├── app.ts              → Configuración de Express (CORS, JSON, rutas, 404)
    │   └── routes/
    │       └── health.ts       → GET /api/health
    └── dist/                   → Build de producción (generado, ignorado por git)
```

## Explicación archivo por archivo (los que no son obvios)

### Raíz

- **`package.json`** — Sin dependencias de runtime; usa `concurrently` para levantar client y server con un solo comando. Los scripts usan `npm --prefix`, así que no hace falta npm workspaces.
- **`.gitignore`** — Cobertura global: `node_modules/`, `dist/`, `build/`, `.env*`, logs, carpetas de editores.

### client/

- **`vite.config.ts`** — Escencial: el `server.proxy` reenvía todo `/api/*` a `http://localhost:4000`, entonces el frontend puede llamar a la API sin hardcodear la URL ni lidiar con CORS.
- **`tsconfig.app.json`** — Código de la app: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `jsx: react-jsx`.
- **`.oxlintrc.json`** — Rules de hooks y de componentes exportados, además de los presets de react/typescript/oxc.

### server/

- **`src/app.ts`** vs **`src/index.ts`** — La separación es a propósito: `app.ts` exporta la app de Express sin escuchar, lo que permite tests de integración (_supertest_) sin levantar un puerto real. `index.ts` es el único que llama a `listen()`.
- **`src/routes/`** — Un archivo por dominio de rutas, montadas en `app.ts` bajo `/api/<dominio>`.
- **`tsconfig.json`** — ESM puro (`"type": "module"`), `moduleResolution: bundler`, salida a `dist/`.

## Carpetas que se agregan en fases futuras (plan)

```
client/src/
├── components/       → Componentes reutilizables de UI
├── features/         → Editor (paleta, lienzo, panel de propiedades)
├── hooks/            → Hooks personalizados
├── lib/              → Utilidades, formato del modelo, validación
└── api/              → Cliente HTTP para la API

server/src/
├── controllers/      → Lógica de los endpoints
├── services/         → Lógica de negocio
├── models/           → Capa de datos / persistencia
└── middleware/       → Validación, errores, autenticación
```