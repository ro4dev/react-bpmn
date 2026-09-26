/**
 * Paso previo de los tests de browser: siembra la base temporal.
 *
 * Corre como `pretest:ui`, o sea **antes** de que Playwright levante la API.
 * Ese orden es el que hace que los tests lean los datos del código actual, y no
 * los de la corrida anterior: la API abre la base al arrancar. Ver la nota de
 * `demo-db.ts`.
 */
import { prepareE2EDb } from "./demo-db.ts";

prepareE2EDb();
