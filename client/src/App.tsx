/**
 * Componente raíz de la aplicación.
 * Por ahora es un placeholder: representa el punto de partida del
 * modelador de procesos. La construcción del editor (canvas + paleta +
 * panel de propiedades) vive en las próximas iteraciones.
 */
import "./App.css";

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>react-bpmn</h1>
        <p className="app__tagline">
          Modelador web de procesos de negocio
        </p>
      </header>

      <section className="app__placeholder">
        <p>
          Acá va a vivir el editor: paleta de elementos, canvas y panel de
          propiedades. Próximamente.
        </p>
      </section>
    </main>
  );
}

export default App;