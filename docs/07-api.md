# 07 — API

> Documento: `docs/07-api.md`
>
> Documenta los endpoints de la API. Todo lo que no dice **"✅ implementado"** es planeado.

## Base URL

- Desarrollo: `http://localhost:4000` (el client la llama via proxy como `/api/*`)
- Prefijo común: `/api`

## Health check

### `GET /api/health` ✅ implementado

Estado de la API.

**Respuesta 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-09-23T00:58:35.938Z"
}
```

---

## Procesos (✅ implementado Fase 3)

Recurso: `/api/processes`

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | --- |
| `GET` | `/api/processes` | Lista de procesos (metadatos + preview + status) | ✅ implementado |
| `GET` | `/api/processes?q=` | Lista filtrada por substring en nombre | ✅ implementado |
| `GET` | `/api/processes/:id` | Detalle de un proceso con su modelo última versión | ✅ implementado |
| `POST` | `/api/processes` | Crea un proceso + versión 1 | ✅ implementado |
| `PUT` | `/api/processes/:id` | Actualiza → crea versión N+1 (no sobrescribe) | ✅ implementado |
| `DELETE` | `/api/processes/:id` | Elimina proceso (cascada versiones) | ✅ implementado |

### Versionado

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | --- |
| `GET` | `/api/processes/:id/versions` | Lista metadatos versiones (DESC) | ✅ implementado |
| `GET` | `/api/processes/:id/versions/:v` | Modelo completo de una versión | ✅ implementado |

### Payload de proceso (request/response)

**POST /api/processes** / **PUT /api/processes/:id** (request body):

```json
{
  "name": "Mi proceso",
  "model": { "version": 1, "nodes": [...], "edges": [...] },
  "comment": "Versión inicial"
}
```

**GET /api/processes** (response item - metadatos):

```json
{
  "id": "uuid-v4",
  "name": "Mi proceso",
  "currentVersion": 3,
  "createdAt": "2026-09-24T10:00:00.000Z",
  "updatedAt": "2026-09-24T12:30:00.000Z",
  "versionCount": 3,
  "preview": "5 nodos, 4 aristas",
  "status": "válido"
}
```

**GET /api/processes/:id** (response - completo):

```json
{
  "id": "uuid-v4",
  "name": "Mi proceso",
  "currentVersion": 3,
  "createdAt": "...",
  "updatedAt": "...",
  "versionCount": 3,
  "preview": "5 nodos, 4 aristas",
  "status": "válido",
  "model": { "version": 1, "nodes": [...], "edges": [...] }
}
```

**GET /api/processes/:id/versions** (response item):

```json
{
  "version": 3,
  "comment": "Ajuste decisión",
  "createdAt": "2026-09-24T12:30:00.000Z"
}
```

### Validación server-side

- `POST` y `PUT` validan el `model` con `validateProcess` compartido (`@shared/validation/validateProcess`).
- Si hay errores (`severity: "error"`): **400** `{ "error": "Modelo inválido", "issues": [...] }`.
- Si no existe: **404** `{ "error": "Proceso no encontrado" }`.

---

## Convenciones de la API

- **JSON** en todo request/response.
- **Errores**: `{ "error": "<mensaje>" }` con el código HTTP correspondiente (400 validación, 404 no existe, 500 inesperado).
- **IDs**: UUID v4 generado por el server.
- **Fechas**: ISO 8601 en UTC.
- CORS habilitado para desarrollo.