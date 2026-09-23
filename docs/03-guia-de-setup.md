# 03 — Guía de setup

> Documento: `docs/03-guia-de-setup.md`

## Requisitos

| Requisito | Versión |
| --- | --- |
| Node.js | 20+ (probado con **v25.8.1**) |
| npm | 10+ (probado con **11.11.0**) |

Verificar:

```bash
node -v
npm -v
```

## Instalación (primera vez)

Desde la raíz del repo:

```bash
npm install                # dependencias de scripting (concurrently)
npm install --prefix client
npm install --prefix server
```

## Comandos

Todos los comandos se corren **desde la raíz del repo**, salvo indicación contraria.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta **server y client juntos** (concurrently) |
| `npm run dev:server` | Levanta solo la API (hot reload con `tsx watch`, puerto 4000) |
| `npm run dev:client` | Levanta solo el frontend (Vite, puerto 5173) |
| `npm run build` | Compila server y client a producción |
| `npm run lint` | Lint de server y client (oxlint) |
| `npm run typecheck` | Typecheck de server (`tsc --noEmit`) + build del client |

### Comandos por aplicación

```bash
# Desde client/
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npm run preview    # sirve el build anterior

# Desde server/
npm run dev        # tsx watch src/index.ts
npm run build      # tsc → dist/
npm run start      # node dist/index.js
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
```

## Verificar que todo anda

1. Levantar todo: `npm run dev`
2. Frontend → abrir `http://localhost:5173` (debería verse el placeholder del modelador).
3. API → `curl http://localhost:4000/api/health` debe responder:

```json
{ "status": "ok", "timestamp": "2026-09-23T00:58:35.938Z" }
```

## Variables de entorno

| Variable | Dónde | Default | Uso |
| --- | --- | --- | --- |
| `PORT` | `server/.env` (ver `server/.env.example`) | `4000` | Puerto de la API |

En desarrollo no hace falta ninguna variable: todo funciona con los defaults.

## Solución de problemas frecuentes

- **El puerto 4000 está ocupado** → cerrá el proceso o definí `PORT` en `server/.env` (y ajustá el proxy en `client/vite.config.ts`).
- **El client no llega a la API** → verificar que el server esté corriendo y que la llamada sea a `/api/*` (el proxy solo reenvía esas rutas).