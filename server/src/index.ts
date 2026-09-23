/**
 * Punto de entrada del servidor.
 * Levanta la aplicación Express en el puerto definido por PORT (default: 4000).
 */
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`);
});