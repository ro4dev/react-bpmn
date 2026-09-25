/**
 * Punto de entrada del servidor.
 * Levanta la aplicación Express en el puerto definido por PORT (default: 4000).
 * Inicializa la base de datos SQLite al arrancar.
 */
import { app } from "./app.js";
import { createStore } from "./db/processStore.js";

const PORT = Number(process.env.PORT ?? 4000);

// Inicializar store (crea DB + esquema si no existe)
const store = createStore();
store.init();
console.log("[server] Base de datos inicializada");

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`);
});