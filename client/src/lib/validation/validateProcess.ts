/**
 * Re-export de la validación semántica compartida (fuente de verdad en `shared/`).
 * Ver `shared/src/validation/validateProcess.ts`.
 */
export {
  type IssueSeverity,
  type ValidationIssue,
  validateProcess,
} from "@shared/validation/validateProcess";