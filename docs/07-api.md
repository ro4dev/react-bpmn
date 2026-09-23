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

## Procesos (planeado, Fase 3)

Recurso: `/api/processes`

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | --- |
| `GET` | `/api/processes` | Lista de procesos (título, versión, estado) | 🚧 planeado |
| `GET` | `/api/processes/:id` | Detalle de un proceso con su modelo completo | 🚧 planeado |
| `POST` | `/api/processes` | Crea un proceso | 🚧 planeado |
| `PUT` | `/api/processes/:id` | Actualiza un proceso | 🚧 planeado |
| `DELETE` | `/api/processes/:id` | Elimina un proceso | 🚧 planeado |
| `GET` | `/api/processes/:id/export.bpmn` | Exporta el proceso en formato estándar | 🤔 en evaluación |

### Ejemplo de payload (borrador, sujeto a [08 — Modelo de datos](./08-modelo-de-datos.md))

```json
{
  "id": "proc_abc123",
  "title": "Proceso de contratación",
  "description": "Flujo de reclutamiento desde la solicitud hasta el alta",
  "version": 1,
  "status": "draft",
  "model": {
    "nodes": [],
    "edges": []
  },
  "createdAt": "2026-09-23T00:00:00.000Z",
  "updatedAt": "2026-09-23T00:00:00.000Z"
}
```

## Convenciones de la API

- **JSON** en todo request/response.
- **Errores**: `{ "error": "<mensaje>" }` con el código HTTP correspondiente (400 validación, 404 no existe, 500 inesperado).
- **IDs**: string generado por el server (prefijo por entidad: `proc_`, `usr_`, etc.).
- **Fechas**: ISO 8601 en UTC.
- CORS habilitado para desarrollo.