/**
 * Panel de validación: muestra en tiempo real los problemas del modelo
 * (errores y advertencias) derivados de `validateProcess`.
 */
import type { ValidationIssue } from "../../lib/validation/validateProcess";
import "./editor.css";

interface ValidationPanelProps {
  /** Problemas detectados en el modelo actual (vacío si es válido). */
  issues: ValidationIssue[];
}

/** Panel de validación del proceso. */
export function ValidationPanel({ issues }: ValidationPanelProps) {
  if (issues.length === 0) {
    return (
      <aside className="rb-validation" aria-label="Panel de validación">
        <h2 className="rb-validation__title">Validación</h2>
        <p className="rb-validation__ok">✓ Modelo válido: sin problemas.</p>
      </aside>
    );
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return (
    <aside className="rb-validation" aria-label="Panel de validación">
      <h2 className="rb-validation__title">Validación</h2>
      {errors.length > 0 && (
        <ul className="rb-validation__list">
          {errors.map((issue, index) => (
            <li
              key={`error-${index}`}
              className="rb-validation__item rb-validation__item--error"
            >
              <span className="rb-validation__badge" aria-hidden="true">
                ✕
              </span>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="rb-validation__list">
          {warnings.map((issue, index) => (
            <li
              key={`warning-${index}`}
              className="rb-validation__item rb-validation__item--warning"
            >
              <span className="rb-validation__badge" aria-hidden="true">
                !
              </span>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}