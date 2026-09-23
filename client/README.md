# client — Frontend de react-bpmn

Aplicación web del modelador de procesos (Vite + React + TypeScript).

- Stack y decisiones → [`docs/05-frontend.md`](../docs/05-frontend.md)
- Estructura del proyecto → [`docs/04-estructura-del-proyecto.md`](../docs/04-estructura-del-proyecto.md)
- Guía de setup → [`docs/03-guia-de-setup.md`](../docs/03-guia-de-setup.md)

## Scripts

```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # sirve el build de producción
```

> Nota: el proxy de Vite reenvía `/api/*` a `http://localhost:4000` (ver `vite.config.ts`).