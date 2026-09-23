# Spec Delta

## ADDED Requirements

### Requirement: Validación del modelo en tiempo real

Cada cambio en el modelo SHALL disparar una validación automática del proceso que cubra, como mínimo: proceso vacío, ausencia de nodo de Inicio, ausencia de nodo de Fin, más de un nodo de Inicio, nodos sin ninguna conexión y nodos no alcanzables desde un Inicio o que no llegan a un Fin. El editor SHALL mostrar los problemas encontrados en un panel de validación, distinguiendo **errores** de **advertencias**.

#### Scenario: Un proceso válido no muestra problemas

- **WHEN** el modelo contiene al menos un Inicio y un Fin y todos los nodos están conectados y son alcanzables
- **THEN** el panel de validación no muestra errores ni advertencias

#### Scenario: Faltan inicio o fin

- **WHEN** el modelo no tiene nodo de Inicio, no tiene nodo de Fin o está vacío
- **THEN** el panel de validación muestra un error que lo indica

#### Scenario: Nodos sin conexión o inalcanzables

- **WHEN** el modelo tiene nodos sin aristas entrantes ni salientes, o nodos que no son alcanzables desde un Inicio
- **THEN** el panel de validación lo señala (advertencia para nodos sin conexión, error para inalcanzables)

#### Scenario: La validación se actualiza al cambiar el modelo

- **WHEN** el usuario agrega, elimina o conecta nodos
- **THEN** el panel de validación se actualiza sin ninguna acción adicional

### Requirement: Deshacer y rehacer

El editor SHALL permitir deshacer y rehacer los cambios del modelo — agregar o eliminar nodos, conectar o desconectar nodos, mover nodos y editar propiedades —, con controles en la barra de herramientas y los atajos `Ctrl+Z` (deshacer) y `Ctrl+Shift+Z` (rehacer). Los controles SHALL estar deshabilitados cuando no hay acciones para deshacer ni rehacer.

#### Scenario: Deshacer un nodo agregado

- **WHEN** el usuario agrega un nodo y presiona deshacer
- **THEN** el nodo desaparece del canvas y del modelo

#### Scenario: Rehacer tras deshacer

- **WHEN** el usuario deshace una acción y luego presiona rehacer
- **THEN** la acción vuelve a aplicarse (el nodo o conexión reaparece)

#### Scenario: Deshacer una edición de propiedades

- **WHEN** el usuario modifica el título o las propiedades de un nodo y presiona deshacer
- **THEN** el nodo vuelve a los valores anteriores

#### Scenario: Historial vacío

- **WHEN** no hay acciones previas para deshacer (o nada para rehacer)
- **THEN** el control correspondiente aparece deshabilitado

### Requirement: Exportación de imagen del diagrama

El usuario SHALL poder exportar el diagrama del proceso actual como imagen en formato **PNG** y como **SVG**, incluyendo todos los nodos y aristas del canvas.

#### Scenario: Exportar PNG

- **WHEN** el usuario elige exportar el diagrama como PNG
- **THEN** se descarga un archivo PNG que contiene todos los nodos y aristas del proceso

#### Scenario: Exportar SVG

- **WHEN** el usuario elige exportar el diagrama como SVG
- **THEN** se descarga un archivo SVG que contiene todos los nodos y aristas del proceso