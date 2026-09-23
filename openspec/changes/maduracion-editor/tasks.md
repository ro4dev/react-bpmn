# Tasks

## 1. Historial deshacer/rehacer

- [ ] 1.1 Implementar en `useProcessModel` el historial de snapshots `{nodes, edges}` (`past`/`future` clonados con `structuredClone`, `canUndo`/`canRedo`, `undo`/`redo`), con checkpoints en `addNode`, `onConnect`, `onBeforeDelete`, `onNodeDragStop` y coalescing de ~700 ms en `updateNode`, y verificar que `npm --prefix client run build` compila y el autoguardado/serialización siguen andando (test ad-hoc de `serialize` con `npx tsx`)
- [ ] 1.2 Agregar botones Deshacer/Rehacer a `Toolbar` (deshabilitados según `canUndo`/`canRedo`) y verificar manualmente que deshacen/rehacen: agregar nodo, conectar, mover y editar propiedades
- [ ] 1.3 Agregar atajos `Ctrl+Z` / `Ctrl+Shift+Z` en `App` (ignorando eventos originados en inputs/textarea) y verificar manualmente que no interfieren con la edición de texto

## 2. Validación del modelo

- [ ] 2.1 Crear `client/src/lib/validation/validateProcess.ts` (`validateProcess` pura → `ValidationIssue[]` con severidad) con las reglas: vacío, falta de Inicio, falta de Fin, múltiples Inicios (warning), nodos sin conexión (warning), nodos no alcanzables desde un Inicio (error) y nodos que no llegan a un Fin (error), y verificar los casos con un check ad-hoc (`npx tsx`)
- [ ] 2.2 Crear `ValidationPanel` en la columna derecha (debajo de propiedades) que muestre los issues derivados con `useMemo` ante cada cambio de modelo, y verificar manualmente escenarios: modelo válido (sin problemas) y modelo incompleto/aislado (errores/advertencias visibles y actualizados en tiempo real)

## 3. Exportación de imagen

- [ ] 3.1 Instalar `html-to-image` en `client/` y crear la utilidad de exportación (PNG y SVG) con `getNodesBounds` + `getViewportForBounds` sobre `.react-flow__viewport`, y verificar que `exportPng`/`exportSvg` descargan archivos válidos (smoke manual + `npm --prefix client run build`)
- [ ] 3.2 Subir `ReactFlowProvider` de `Canvas` a `App.tsx` para que `Toolbar` acceda a `useReactFlow`/`useStoreApi`, agregar botones "Exportar PNG" y "Exportar SVG", y verificar que el editor sigue funcionando completo (drag, conexiones, minimapa)

## 4. Polish del canvas

- [ ] 4.1 Configurar `MiniMap` con `nodeColor` por tipo de nodo (inicio/fin/tarea/decisión) y revisar snap-to-grid y estilos, y verificar visualmente en el navegador

## 5. ADR y documentación

- [ ] 5.1 Resolver AD-009 en `docs/09-decisiones-de-diseno.md` (conclusión: estado local con hooks, sin librería global) y agregar AD-012 (historial de snapshots) y AD-013 (exportación con `html-to-image`), y verificar la tabla del documento
- [ ] 5.2 Actualizar `docs/05-frontend.md` (estructura con `lib/validation/`, toolbar ampliada) y `docs/10-roadmap.md` (Fase 2 ✅) y verificar que los cambios quedan documentados
- [ ] 5.3 Correr `npm run lint` (client y raíz) con 0 errores y marcar las tareas completadas