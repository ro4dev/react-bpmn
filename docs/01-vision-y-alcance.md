# 01 — Visión y alcance

> Documento: `docs/01-vision-y-alcance.md`

## Qué es

**react-bpmn** es una herramienta web para **modelar procesos de negocio** de forma visual.

Un proceso es una secuencia de pasos por los que algo (una solicitud, una postulación, un pedido) pasa dentro de una organización. Ejemplos:

- **Contratación**: la solicitud llega → se revisa el CV → entrevistas → oferta → alta.
- **Validación de solicitudes**: se recibe una solicitud → se verifican datos → aprobación de gerencia → respuesta al solicitante.
- Cualquier flujo con pasos, decisiones y responsables.

La herramienta permite *dibujar* ese flujo: nodos (pasos), conexiones (flechas), decisiones (sí/no) y responsables, en un lienzo visual.

## Objetivos

1. Que una persona **sin conocimientos técnicos** pueda dibujar el proceso de su área sin ayuda de desarrolladores.
2. Que un **analista técnico** pueda definir procesos más complejos (condiciones, roles, validaciones).
3. Que el resultado quede **documentado y consultable**: el diagrama *es* la documentación.
4. (Futuro, en evaluación) Que el proceso modelado **se ejecute**: el sistema genere tareas, estados y avance el flujo con usuarios reales.

## Usuarios / personas

| Persona | Necesidad | Nivel técnico |
| --- | --- | --- |
| **Persona de negocio** (RRHH, operaciones, finanzas) | Dibujar el proceso de su área, dejarlo documentado | Bajo — necesita algo visual e intuitivo, sin jerga BPMN |
| **Analista técnico / de procesos** | Modelar flujos complejos con condiciones y roles | Medio/alto — puede usar notación estándar |

## Alcance actual

- **Fase 0 (completada):** scaffold del proyecto (frontend + backend + documentación).
- **Fase 1+:** editor visual (ver [Roadmap](./10-roadmap.md)).

## Fuera de alcance (por ahora)

- Ejecución de procesos / motor de workflow (en evaluación, ver [Decisiones — AD-008](./09-decisiones-de-diseno.md)).
- Motor de reglas complejas.
- Aplicación móvil nativa.
- Integraciones con terceros (la idea es que el modelo sea exportable/importable, pero no hay integraciones en la hoja de ruta inicial).

## Preguntas abiertas

- **¿El modelo debe seguir el estándar BPMN 2.0 o un formato visual propio simplificado?** Esto define la librería del editor y el formato de guardado. Ver [AD-006](./09-decisiones-de-diseno.md).
- **¿Alcanza con modelar + documentar, o también se ejecuta?** Cambia sustancialmente el alcance. Ver [AD-008](./09-decisiones-de-diseno.md).
- **¿Multi-usuario con roles, o uso individual por ahora?**