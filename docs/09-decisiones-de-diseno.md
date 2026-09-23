# 09 — Decisiones de diseño (ADR)

> Documento: `docs/09-decisiones-de-diseno.md`
>
> Registro de decisiones de arquitectura (ADR: *Architecture Decision Records*). Cada decisión importante agrega una entrada con **contexto, decisión y consecuencias**.

| ADR | Decisión | Estado |
| --- | --- | --- |
| [AD-001](#ad-001-monorepo-simple-con-client--server) | Monorepo simple con `client/` + `server/` y `npm --prefix` | ✅ adoptada |
| [AD-002](#ad-002-typescript-en-todo-el-proyecto) | TypeScript en frontend y backend | ✅ adoptada |
| [AD-003](#ad-003-react-19--vite-en-el-frontend) | React 19 + Vite 8 | ✅ adoptada |
| [AD-004](#ad-004-express-5-en-el-backend) | Express 5 | ✅ adoptada |
| [AD-005](#ad-005-editor-con-react-flow) | Editor sobre React Flow (`@xyflow/react`) | 📌 planeada (Fase 1) |
| [AD-006](#ad-006-formato-del-modelo-a-definir) | BPMN estándar vs formato propio simplificado | ⏳ abierta |
| [AD-007](#ad-007-puertos-y-proxy-de-desarrollo) | Server en 4000, client en 5173 con proxy `/api` | ✅ adoptada |
| [AD-008](#ad-008-alcance-modelar-vs-ejecutar) | ¿Solo modelar o también ejecutar procesos? | ⏳ abierta |
| [AD-009](#ad-009-estado-global) | Estado global del frontend | ⏳ abierta (evaluar en Fase 2) |
| [AD-010](#ad-010-base-de-datos) | Motor de persistencia del server | ⏳ abierta (Fase 3) |

---

### AD-001: Monorepo simple con client/ + server/

**Contexto:** el proyecto necesita frontend y backend; hay que decidir cómo organizar el repo.

**Decisión:** dos carpetas independientes (`client/`, `server/`) con sus propios `package.json`, coordinadas por scripts raíz con `npm --prefix`. **Sin** npm workspaces.

**Consecuencias:** instalaciones separadas (`npm install --prefix client`), pero cero fricción de tooling y builds independientes. Fácil de migrar a workspaces o a repos separados si hiciera falta.

### AD-002: TypeScript en todo el proyecto

**Contexto:** el modelo de proceso es un grafo tipado; el error de tipos es caro acá. Además es la convención del resto de los proyectos React del autor.

**Decisión:** TypeScript estricto en `client/` y `server/`.

**Consecuencias:** types compartidos posibles entre front y back; un poco más de boilerplate, aceptado.

### AD-003: React 19 + Vite en el frontend

**Contexto:** necesidad de un dev server rápido y React moderno, alineado con los proyectos previos del autor.

**Decisión:** Vite 8 + React 19 + plugin oficial. Lint con oxlint (rápido, sin config).

**Consecuencias:** cero fricción al día de hoy; ecosistema Vite maduro.

### AD-004: Express 5 en el backend

**Contexto:** API REST sencilla, de crecimiento incremental.

**Decisión:** Express 5 (la versión actual), servido por Node, con `tsx` para dev y `tsc` para build.

**Consecuencias:** middleware y rutas simples; la app está separada del listener (`app.ts` vs `index.ts`) para poder testear sin puertos.

### AD-005: Editor con React Flow

**Contexto:** el modelador necesita canvas, nodos, conexiones, zoom y drag-and-drop. Construirlo desde cero es mucho trabajo y error-prone.

**Decisión:** usar `@xyflow/react` (React Flow) como base del lienzo del editor. Proporciona nodos, edges, minimapa, controles, snap-to-grid y serialización de `{nodes, edges}`.

**Consecuencias:** el formato interno del modelo será JSON de `{nodes, edges}` de React Flow (compatible con el borrador de [08 — Modelo de datos](./08-modelo-de-datos.md)). Se instala y configura en la Fase 1.

### AD-006: Formato del modelo — a definir

**Contexto:** ¿exportar BPMN 2.0 estándar (interoperable con Camunda, Bizagi…) o un formato visual propio simplificado (más fácil para usuarios no técnicos)?

**Decisión:** ⏳ Abierta. En la Fase 1 se arranca con el formato propio simplificado (React Flow JSON) para avanzar; la compatibilidad BPMN se evalúa antes de la persistencia definitiva.

**Consecuencias:** arrancar rápido con UX simple; si luego se quiere BPMN estándar, hay que mapear nodos propios → elementos BPMN.

### AD-007: Puertos y proxy de desarrollo

**Contexto:** client y server corren en puertos distintos en dev.

**Decisión:** server en `4000` (configurable por `PORT`), client en `5173` (default de Vite), con `server.proxy` en `vite.config.ts` reenviando `/api/*` al server. CORS habilitado igualmente para usos externos.

**Consecuencias:** el frontend llama a `/api/...` sin URL absoluta; cero CORS en el día a día.

### AD-008: Alcance — modelar vs ejecutar

**Contexto:** la herramienta puede ser solo un editor/documentador, o incluir un motor que ejecute los procesos (tareas asignadas, estados, avance de flujo). Cambia el alcance mucho.

**Decisión:** ⏳ Abierta. El roadmap prioriza **modelar y documentar** primero; la ejecución se evalúa al llegar a un modelado estable.

**Consecuencias:** el formato del modelo debe guardarse en un esquema que permita *algún día* ejecutarlo (separar geometría de la semántica de los nodos, `props` con `responsible`, `condition`…).

### AD-009: Estado global

**Contexto:** el editor tendrá estado compartido (modelo, selección, historial de deshacer).

**Decisión:** ⏳ Abierta. Sin librería hoy; se evalúan Zustand/Jotai/Context en la Fase 2 cuando aparezca la complejidad real.

### AD-010: Base de datos

**Contexto:** la persistencia definitiva de procesos (Fase 3) necesita un motor.

**Decisión:** ⏳ Abierta. Candidatos: SQLite (cero infra, perfecto para empezar) o Postgres (si aparece un servicio de hosting). La capa de datos queda aislada en `server/src/models/` para no acoplarse.