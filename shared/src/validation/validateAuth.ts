/**
 * Validación de datos de autenticación (Fase 4).
 * Funciones puras compartidas entre client y server.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function addError(errors: string[], msg: string): void {
  errors.push(msg);
}

/** Valida datos de registro. */
export function validateRegister(input: { email: string; password: string; name: string }): ValidationResult {
  const errors: string[] = [];

  if (!input.email || typeof input.email !== "string") {
    addError(errors, "Email obligatorio");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    addError(errors, "Email inválido");
  }

  if (!input.password || typeof input.password !== "string") {
    addError(errors, "Contraseña obligatoria");
  } else if (input.password.length < 8) {
    addError(errors, "La contraseña debe tener al menos 8 caracteres");
  }

  if (!input.name || typeof input.name !== "string" || input.name.trim() === "") {
    addError(errors, "Nombre obligatorio");
  } else if (input.name.trim().length > 100) {
    addError(errors, "Nombre demasiado largo (máx. 100 caracteres)");
  }

  return { valid: errors.length === 0, errors };
}

/** Valida datos de login. */
export function validateLogin(input: { email: string; password: string }): ValidationResult {
  const errors: string[] = [];

  if (!input.email || typeof input.email !== "string") {
    addError(errors, "Email obligatorio");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    addError(errors, "Email inválido");
  }

  if (!input.password || typeof input.password !== "string") {
    addError(errors, "Contraseña obligatoria");
  }

  return { valid: errors.length === 0, errors };
}