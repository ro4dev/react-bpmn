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
| [AD-005](#ad-005-editor-con-react-flow) | Editor sobre React Flow (`@xyflow/react`) | ✅ adoptada (Fase 1) |
| [AD-006](#ad-006-formato-del-modelo-a-definir) | BPMN estándar vs formato propio simplificado | ✅ adoptada (formato propio, provisional) |
| [AD-007](#ad-007-puertos-y-proxy-de-desarrollo) | Server en 4000, client en 5173 con proxy `/api` | ✅ adoptada |
| [AD-008](#ad-008-alcance-modelar-vs-ejecutar) | ¿Solo modelar o también ejecutar procesos? | ✅ **resuelta (Fase 4: modelar; ejecución = Fase 5)** |
| [AD-009](#ad-009-estado-global) | Estado global del frontend | ✅ adoptada (Fase 2: estado local con hooks) |
| [AD-010](#ad-010-base-de-datos) | Motor de persistencia del server | ✅ **adoptada (Fase 3: SQLite nativo)** |
| [AD-011](#ad-011-estado-de-trabajo-del-editor-vs-modelo) | Estado de trabajo del editor (React Flow) vs modelo persistible | ✅ adoptada (Fase 1) |
| [AD-012](#ad-012-historial-de-snapshots-para-deshacerrehacer) | Deshacer/rehacer con snapshots en el historial | ✅ adoptada (Fase 2) |
| [AD-013](#ad-013-exportacion-de-imagen-con-html-to-image) | Exportación PNG/SVG con `html-to-image` | ✅ adoptada (Fase 2) |
| [AD-014](#ad-014-capa-de-datos-aislada-sqlite) | Capa de datos SQLite aislada (`server/src/db/`) | ✅ adoptada (Fase 3) |
| [AD-015](#ad-015-modelo-compartido-shared) | Modelo + validación pura en `shared/` con alias `@shared/*` | ✅ adoptada (Fase 3) |
| [AD-016](#ad-016-versionado-inmutable-procesos) | Versionado inmutable por guardado (`ProcessVersion`) | ✅ adoptada (Fase 3) |
| [AD-017](#ad-017-autenticacion-propia-emailpassword--jwt) | Autenticación propia: email/password + JWT | ✅ **adoptada (Fase 4)** |
| [AD-018](#ad-018-autorizacion-por-proceso-ownereditorviewer) | Autorización por proceso con roles `owner`/`editor`/`viewer` | ✅ **adoptada (Fase 4)** |
| [AD-019](#ad-019-invitacion-por-token-jwt-firmado) | Invitación a usuarios no registrados vía token firmado | ✅ **adoptada (Fase 4)** |
| [AD-020](#ad-020-timeline-de-versiones-en-la-ui) | Timeline de versiones en la UI del editor | ✅ **adoptada (Fase 4)** |
| [AD-021](#ad-021-hash-de-tokens-opacos-con-sha-256) | Hash de refresh tokens con SHA-256 (no bcrypt) | ✅ **adoptada (Fase 4)** |

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

**Consecuencias:** el formato interno del modelo será JSON de `{nodes, edges}` de React Flow (compatible con el borrador de [08 — Modelo de datos](./08-modelo-de-datos.md)). Instalado (`@xyflow/react` v12) y configurado en la Fase 1.

### AD-006: Formato del modelo — a definir

**Contexto:** ¿exportar BPMN 2.0 estándar (interoperable con Camunda, Bizagi…) o un formato visual propio simplificado (más fácil para usuarios no técnicos)?

**Decisión:** ✅ adoptada (provisional). Se implementó el **formato propio simplificado** (React Flow JSON, `ProcessModel` en `client/src/lib/model/`) en la Fase 1 para avanzar; la compatibilidad BPMN se reevalúa antes de la persistencia definitiva (Fase 3).

**Consecuencias:** arrancar rápido con UX simple; si luego se quiere BPMN estándar, hay que mapear nodos propios → elementos BPMN.

### AD-007: Puertos y proxy de desarrollo

**Contexto:** client y server corren en puertos distintos en dev.

**Decisión:** server en `4000` (configurable por `PORT`), client en `5173` (default de Vite), con `server.proxy` en `vite.config.ts` reenviando `/api/*` al server. CORS habilitado igualmente para usos externos.

**Consecuencias:** el frontend llama a `/api/...` sin URL absoluta; cero CORS en el día a día.

### AD-008: Alcance — modelar vs ejecutar

**Contexto:** la herramienta puede ser solo un editor/documentador, o incluir un motor que ejecute los procesos (tareas asignadas, estados, avance de flujo). Cambia el alcance mucho.

**Decisión:** ✅ **Resuelta en la Fase 4: el alcance es _modelar_, no _ejecutar_.** La Fase 4 (colaboración/publicación: auth, permisos, invitaciones, historial) cerró la última decisión abierta del modelado; el motor de ejecución queda para la **Fase 5** y requiere una decisión de producto nueva (instancias, estados de tarea, disparadores, idempotencia).

**Consecuencias:** el formato del modelo guarda geometría y semántica separadas (`position` vs `props`), así que un motor de ejecución se puede agregar sin migración. La validación ya exige alcanzabilidad desde el Inicio y llegada a un Fin, que es el invariante mínimo que necesita cualquier ejecutor.

### AD-012: Historial de snapshots para deshacer/rehacer

**Contexto:** el editor necesita deshacer/rehacer sin librería global (ver AD-009/AD-012) ni dependencias nuevas, sobre el estado `{nodes, edges}` del editor.

**Decisión:** ✅ **Adoptada (Fase 2):** historial de **snapshots** en `useProcessModel` (`past`/`future`, clonados con `structuredClone`), con checkpoints en acciones discretas (agregar `addNode`, conectar `onConnect`, eliminar `onBeforeDelete`, arrastrar `onNodeDragStart`/`onNodeDragStop`) y **coalescing por pausa (~700 ms)** para ediciones de propiedades (`updateNode`). `undo`/`redo` restauran los snapshots; `canUndo`/`canRedo` habilitan los botones y los atajos `Ctrl+Z` / `Ctrl+Shift+Z` (ignorando eventos en inputs).

**Consecuencias:** historial acotado por uso (snapshots en memoria, sin persistir); el `structuredClone` evita mutaciones compartidas; el autoguardado/serialización de la Fase 1 sigue funcionando porque el historial es estado paralelo al modelo.

### AD-013: Exportación de imagen con html-to-image

**Contexto:** React Flow v12 removió `toPng`/`toSvg` del core, y el paquete `@xyflow/tools` no existe (verificado en npm). Se necesita exportar el diagrama como PNG y SVG.

**Decisión:** ✅ **Adoptada (Fase 2):** usar **`html-to-image`** (estándar de la comunidad React Flow) sobre el elemento `.react-flow__viewport`, combinando `getNodesBounds` + `getViewportForBounds` para encuadrar todos los nodos en una imagen de tamaño fijo con fondo blanco; exportación via `toPng`/`toSvg` + descarga. El `ReactFlowProvider` sube a `App` para que la toolbar acceda a `useReactFlow`/`useStoreApi`.

**Consecuencias:** nueva dependencia dev en `client/`; la exportación clona el DOM (no toca el estado real); gráficos generados con fondo blanco uniforme (sin necesidad de exportar el minimapa distintas).

### AD-009: Estado global

**Contexto:** el editor tendrá estado compartido (modelo, selección, historial de deshacer).

**Decision:** ⏳ ⏳ implementación 🚧→ ✅ **Adoptada (Fase 2, AD-009 resuelto):** estado local con hooks. El estado global del editor vive en los hooks (`useProcessModel`) + estado local de React en `App`; **sin librería global** (ni Zustand ni Jotai ni Context global). Se evaluó de nuevo en la Fase 2 con el historial deshacer/rehacer y la validación, y se concluyó que las 2 features se resuelven con hooks puros y estado local (**AD-012**, **AD-013**).

**Consecuencias:** cero dependencia nueva; estado en el DOM de React (se pierde al recargar si el modelo no se persistió); el `ProcessModel` queda como única fuente de verdad para persistencia. Si la colaboración en tiempo real (Fase 4) lo pide, se revisita.

### AD-010: Base de datos

**Contexto:** la persistencia definitiva de procesos (Fase 3) necesita un motor.

**Decisión:** ⏳ Abierta. Candidatos: SQLite (cero infra, perfecto para empezar) o Postgres (si aparece un servicio de hosting). La capa de datos queda aislada en `server/src/models/` para no acoplarse.

### AD-011: Estado de trabajo del editor vs modelo

**Contexto:** el editor de la Fase 1 podía guardar el estado de React Flow directo, o mantener el `ProcessModel` como única fuente de verdad y derivar de él la vista.

**Decisión:** el **estado de trabajo** del editor es el `{nodes, edges}` de React Flow (con `kind` y `props` en `node.data`), y el `ProcessModel` es el **formato de persistencia/exportación/importación**: la serialización `modelo ⇄ React Flow` vive en un solo lugar (`client/src/lib/model/serialize.ts`), con validación de forma en runtime.

**Consecuencias:** cero sincronización duplicada en una fase sin colaboración ni versionado. Si en la Fase 2 el estado global (AD-009) o el versionado (Fase 3) lo piden, `serialize.ts` es el punto único a reutilizar para mantener el `ProcessModel` como fuente de verdad.
---

### AD-010: Base de datos

**Contexto:** la persistencia definitiva de procesos (Fase 3) necesita un motor.

**Decisión:** ✅ **Adoptada (Fase 3): SQLite nativo (`node:sqlite` con `DatabaseSync`)**. Cero dependencias, cero compilación nativa, verificado en Node 25.8.1. La capa de datos queda aislada en `server/src/db/` (`schema.ts` + `processStore.ts`). La DB vive en `server/data/processes.db` (gitignored).

**Consecuencias:** operativo inmediato sin infra; escalable a Postgres cambiando solo la capa `db/` (AD-014). El `node:sqlite` síncrono simplifica el código vs. async pool. La limitación: no concurrencia pesada (no requerida en Fase 3–4).

---

### AD-014: Capa de datos aislada (SQLite)

**Contexto:** la persistencia server necesita un lugar claro y reemplazable.

**Decisión:** ✅ **Adoptada (Fase 3):** todo el acceso a SQLite encapsulado en `server/src/db/`:
- `schema.ts`: `CREATE TABLE IF NOT EXISTS Process + ProcessVersion` + índices.
- `processStore.ts`: `ProcessStore` class con `DatabaseSync` + CRUD + versionado inmutable.
- API pura: `create/list/get/update/delete + listVersions/getVersion`.

**Consecuencias:** cero SQL en las rutas; testeo aislado (`:memory:`); migración futura a Postgres = solo reimplementar `ProcessStore` con `pg`/`kysely`. `DatabaseSync` síncrono evita callback hell y `await` en código que no necesita concurrencia real.

---

### AD-015: Modelo compartido `shared/`

**Contexto:** client y server necesitan el mismo `ProcessModel` + `validateProcess` para que el server valide lo que el client envía (misma lógica, 0 duplicación).

**Decisión:** ✅ **Adoptada (Fase 3):** `shared/` en la raíz del monorepo con `src/model/types.ts` + `src/validation/validateProcess.ts`. Consumido vía **path alias TypeScript**:
- Client: `vite.config.ts` `resolve.alias["@shared"]` + `tsconfig.app.json` `paths`.
- Server: `tsconfig.json` `baseUrl: "."`, `paths: { "@shared/*": ["../shared/src/*"] }`, `rootDir: ".."`, `include: ["src", "../shared/src"]` → emite `dist/server/...` + `dist/shared/...`; `start` ajustado a `node dist/server/src/index.js`.

**Consecuencias:** una sola fuente de verdad (sin `shared/` como paquete publicado ni build intermedio). El fallback documentado (copia server-local en `server/src/lib/validation/`) quedó como nota; el alias funciona limpio. `verbatimModuleSyntax` y `erasableSyntaxOnly` respetados.

---

### AD-016: Versionado inmutable por guardado

**Contexto:** cada guardado en server debe crear una versión histórica, no sobrescribir.

**Decisión:** ✅ **Adoptada (Fase 3):** tabla `ProcessVersion` (PK compuesta `processId, version`) con `model` JSON + `comment` + `createdAt`. `Process.currentVersion` apunta a la última. `PUT /api/processes/:id` → `version+1` + `INSERT ProcessVersion` (no `UPDATE`). API de versiones: `GET /:id/versions` (metadatos DESC) + `GET /:id/versions/:v` (modelo completo).

**Consecuencias:** historial completo y auditable sin lógica compleja. El `comment` opcional permite "mensajes de commit". El cliente expone `vN` en la toolbar y lista versiones en la API (UI de timeline: Fase 4 → [AD-020](#ad-020-timeline-de-versiones-en-la-ui)).

### AD-017: Autenticación propia (email/password + JWT)

**Contexto:** sin usuarios no hay dueño de un proceso ni colaboración. Las opciones eran un proveedor externo (Auth0, Supabase, Clerk) o autenticación propia.

**Decisión:** ✅ **Adoptada (Fase 4):** autenticación propia con **email/password + JWT**.
- Passwords con **bcrypt, 12 rondas** (el costo de acá es login, no throughput).
- **Access token** JWT HS256, TTL 15 min, firmado con `JWT_SECRET` de `server/.env` (obligatorio: el server no arranca sin él).
- **Refresh token opaco** de 48 bytes aleatorios, TTL 7 días, en **cookie httpOnly** (`sameSite=lax`, `secure` en producción) y hasheado en la tabla `RefreshToken` (ver AD-021). Se **rota** en cada refresh: el viejo se elimina, así que reutilizar un token robado falla.
- En el cliente el access token vive **solo en memoria** (`lib/api/session.ts`), nunca en `localStorage`; el refresh viaja en la cookie, así que recargar la página recupera la sesión con un `POST /api/auth/refresh`.

**Consecuencias:** sin dependencia externa ni costo por usuario activo, y `JWT_SECRET` pasa a ser un requisito de despliegue (está en `server/.env.example`). A cambio: correr con un solo proceso (el estado de sesión es la DB, no la memoria, pero no hay revocación "de todas las sesiones" sin la tabla `RefreshToken`, que sí existe). El refresh automático lo maneja `apiFetch`, no cada página.

### AD-018: Autorización por proceso (owner/editor/viewer)

**Contexto:** con varios usuarios, hace falta decidir si los permisos son globales o por recurso. Un modelo de workspaces/equipos agregaba una entidad entera que el producto no necesita todavía.

**Decisión:** ✅ **Adoptada (Fase 4):** permisos **por proceso**, vía la tabla `ProcessCollaborator` (`processId`, `userId`, `role`) con tres roles: `owner`, `editor`, `viewer`.

| Acción | owner | editor | viewer |
| --- | :-: | :-: | :-: |
| Ver el proceso y su historial | ✅ | ✅ | ✅ |
| Guardar cambios (crea versión) | ✅ | ✅ | ❌ |
| Restaurar una versión | ✅ | ✅ | ❌ |
| Invitar / quitar colaboradores | ✅ | ❌ | ❌ |
| Cancelar invitaciones | ✅ | ❌ | ❌ |
| Borrar el proceso | ✅ | ❌ | ❌ |

La fuente de verdad es `Process.ownerId`; el creador queda como `owner` automáticamente y siempre gana sobre cualquier fila de colaboradores. La función de chequeo es una sola (`processStore.canAccess`), usada por todas las rutas, que además pasan por `authRequired`.

**Consecuencias:** cero entidades extra y el modelo de autorización es legible de un vistazo. El rol del usuario actual viene en los metadatos de cada proceso (`ProcessMeta.role`), así la UI muestra el badge y deshabilita acciones sin pedir permisos extra. Un proceso sin `ownerId` (migrado de la Fase 3) deja de ser accesible hasta que se le asigne uno.

### AD-019: Invitación por token JWT firmado

**Contexto:** el owner quiere compartir con alguien que todavía no tiene cuenta. Crear la cuenta automáticamente sería una decisión de producto fuerte; tampoco hay SMTP en el alcance.

**Decisión:** ✅ **Adoptada (Fase 4):** invitar por email genera una fila en `Invitation` con un **token JWT firmado** (`{ iid, email, processId, role }`, 7 días). Al aceptarlo:
1. se verifica la firma (sin `JWT_SECRET` el token es inválido),
2. se exige que la invitación siga viva en la DB (permite revocar sin esperar a que expire),
3. se exige que el usuario autenticado tenga **ese** email,
4. se agrega como colaborador y la invitación se invalida (no se puede aceptar dos veces).

Si el email **ya está registrado** no hace falta invitación: se agrega como colaborador directo. Sin SMTP, el "email" se **loguea en la consola** y la UI muestra un link copiable (`/invitaciones?token=…`); `GET /api/invitations/mine` lista las pendientes del usuario.

**Consecuencias:** el alta de colaborador al aceptar usa `addCollaboratorDirect` (sin chequeo de permisos) porque el owner ya la autorizó al emitir la invitación; usar `addCollaborator` exigiría `manage_collaborators` al que acepta, o sea fallaría siempre.

### AD-020: Timeline de versiones en la UI

**Contexto:** la Fase 3 guardaba el historial pero la UI solo mostraba `vN`. Sin visibilidad del cambio, el versionado es útil para auditar, no para trabajar.

**Decisión:** ✅ **Adoptada (Fase 4):** panel lateral derecho en el editor (cuarta columna del grid, se abre con el botón **Historial** de la toolbar). Lista las versiones en orden descendente con fecha y `comment`; al seleccionar una muestra el **diff contra la versión anterior** y un botón **Restaurar**. El diff es **semántico de grafo** (`client/src/lib/model/diff.ts`): nodos agregados/eliminados/modificados/movidos y aristas agregadas/eliminadas por separado, con `fields` para los modificados. Restaurar es `POST /:id/versions/:v/restore`, que **crea la versión N+1** con el modelo viejo: el historial sigue siendo inmutable (AD-016).

**Consecuencias:** comparar dos versiones cuesta 2 requests (el servidor devuelve modelos completos, no hay diff en el backend — con volúmenes chicos es lo más simple y evita duplicar la lógica de diff en dos lenguajes). Un `viewer` puede ver el historial pero la UI oculta "Restaurar" y lo explica. La v1 se compara contra el modelo vacío, porque no tiene versión anterior.

### AD-021: Hash de tokens opacos con SHA-256 (no bcrypt)

**Contexto:** la primera implementación hasheaba el refresh token con bcrypt y verificaba **recorriendo toda la tabla** con un `compareSync` por fila. Además comparaba el token contra el `id` de la fila en vez del hash, así que la rotación nunca revocaba nada.

**Decisión:** ✅ **Adoptada (Fase 4):** los tokens opacos (refresh e invitación) se hashean con **SHA-256** y se verifican con un `SELECT ... WHERE tokenHash = ?`. bcrypt queda reservado para passwords, que sí son de baja entropía y se verifican poco seguido.

**Consecuencias:** la verificación es un lookup por índice en vez de O(n) comparaciones lentas. Es seguro porque el token tiene 122+ bits de entropía de CSPRNG: no hay diccionario que atacar, y un atacante con acceso a la DB obtiene el SHA-256 de algo que no puede producir. Si alguna vez un token pasa a ser derivado de algo elegido por el usuario, hay que volver a bcrypt.
