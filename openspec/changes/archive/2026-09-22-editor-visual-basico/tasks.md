# Tasks

## 1. Setup y modelo

- [x] 1.1 Instalar `@xyflow/react` (v12+) en `client/` y verificar que `npm --prefix client run build` compila sin errores
- [x] 1.2 Definir en `client/src/lib/model/` los tipos `ProcessModel`, `ProcessNodeKind`, `ProcessNode` y `ProcessEdge` según design D2, y verificar que `npm --prefix client run build` (typecheck) pasa
- [x] 1.3 Crear constantes de paleta (Inicio → `start`, Fin → `end`, Tarea → `task`, Decisión → `decision`) y verificar que se renderiza la lista de 4 elementos en `Palette.tsx`

## 2. Canvas y elementos

- [x] 2.1 Montar `Canvas.tsx` con `ReactFlow`, `nodeTypes` custom (círculo para start/end, rectángulo para task, rombo para decision) y verificar que el canvas se renderiza con los controles de viewport (zoom, minimapa opcional, grid)
- [x] 2.2 Implementar drag-and-drop desde `Palette.tsx` al canvas: soltar crea un nodo del tipo correspondiente en la posición indicada, y verificar manualmente que los 4 tipos se agregan correctamente
- [x] 2.3 Habilitar conexiones entre nodos (`onConnect`) y verificar manualmente que se crea una arista arrastrando de origen a destino

## 3. Panel de propiedades

- [x] 3.1 Implementar `PropertiesPanel.tsx` que muestre los campos título, descripción y responsable del nodo seleccionado, y verificar que al seleccionar nodos distintos el panel refleja el nodo activo
- [x] 3.2 Conectar la edición del panel al modelo: cambiar el título actualiza la etiqueta en el canvas y los demás campos quedan en `props`, y verificar manualmente la actualización

## 4. Persistencia local

- [x] 4.1 Implementar el hook `useProcessModel` con autoguardado debounced (~500 ms) a `localStorage` y restauración del último modelo al montar, y verificar que al recargar la página el proceso persiste
- [x] 4.2 Verificar que el guardado incluye nodos, aristas y propiedades (revisar el JSON guardado en `localStorage` tras editar)

## 5. Exportar / importar

- [x] 5.1 Implementar exportación: serializar el modelo actual a JSON y descargarlo como archivo, y verificar que el archivo descargado representa el proceso completo
- [x] 5.2 Implementar importación con validación de forma (objeto con `nodes`/`edges` e ids consistentes), y verificar que importar un JSON válido reemplaza el modelo y que un JSON inválido muestra error sin modificar el modelo actual

## 6. Integración y layout

- [x] 6.1 Actualizar `App.tsx` al layout del editor (toolbar + canvas + panel de propiedades) y verificar que la app levanta en dev (`npm run dev`) sin errores de consola
- [x] 6.2 Smoke test integral en el navegador del flujo completo: dibujar un proceso con los 4 tipos, conectarlo, editar propiedades, recargar (persistencia), exportar e importar — y verificar que `npm run lint` y `npm run build` pasan

## 7. Documentación

- [x] 7.1 Actualizar `docs/` según la convención del proyecto: marcar la Fase 1 en `docs/10-roadmap.md`, reflejar el editor implementado en `docs/05-frontend.md` y `docs/08-modelo-de-datos.md` si corresponde, y registrar cualquier decisión nueva en `docs/09-decisiones-de-diseno.md` — verificar que los cambios quedan coherentes con el README