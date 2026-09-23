# editor-visual Specification

## Purpose
Editor visual de procesos de negocio en el navegador: permite dibujar un proceso con paleta de elementos, conexiones entre nodos, edición de propiedades y guardado del modelo de forma local.

## Requirements

### Requirement: Paleta de elementos del editor

El editor SHALL ofrecer una paleta con cuatro tipos de nodo arrastrables: **Inicio**, **Fin**, **Tarea** y **Decisión**.

#### Scenario: La paleta muestra los cuatro tipos de nodo

- **WHEN** el usuario abre el editor
- **THEN** la paleta muestra los tipos de nodo Inicio, Fin, Tarea y Decisión, cada uno identificable visualmente

### Requirement: Colocación de nodos por drag-and-drop

El usuario SHALL poder arrastrar un elemento desde la paleta y soltarlo sobre el canvas para agregarlo al modelo, con la posición en la que se soltó.

#### Scenario: Agregar una tarea al canvas

- **WHEN** el usuario arrastra "Tarea" desde la paleta y la suelta sobre el canvas
- **THEN** el canvas muestra un nuevo nodo de tipo Tarea en la posición donde se soltó
- **AND** el nodo queda seleccionado y forma parte del modelo del proceso

### Requirement: Conexiones entre nodos

El usuario SHALL poder conectar dos nodos arrastrando desde un nodo origen hasta un nodo destino; la conexión queda registrada como arista del modelo.

#### Scenario: Conectar el inicio con una tarea

- **WHEN** el usuario arrastra desde el nodo de Inicio hasta un nodo de Tarea
- **THEN** el canvas muestra una arista entre ambos nodos
- **AND** la arista queda registrada en el modelo del proceso

### Requirement: Edición de propiedades del nodo seleccionado

Cuando un nodo está seleccionado, el editor SHALL mostrar un panel de propiedades con campos editables de **título**, **descripción** y **responsable**, y SHALL reflejar los cambios en el nodo.

#### Scenario: Cambiar el título de un nodo

- **WHEN** el usuario selecciona un nodo tipo Tarea y edita el campo de título
- **THEN** el panel de propiedades muestra los campos título, descripción y responsable con los valores actuales del nodo
- **AND** el nuevo título se refleja en la etiqueta del nodo en el canvas
- **AND** el valor queda guardado en el modelo

#### Scenario: El panel refleja el nodo seleccionado

- **WHEN** el usuario selecciona un nodo distinto
- **THEN** el panel de propiedades muestra las propiedades del nodo recién seleccionado

### Requirement: Guardado local con autoguardado

El editor SHALL persistir el modelo del proceso en `localStorage` de forma automática ante cambios, y SHALL restaurar el último modelo guardado al volver a abrir el editor en el mismo navegador.

#### Scenario: El modelo se autoguarda tras un cambio

- **WHEN** el usuario agrega un nodo o edita una propiedad
- **THEN** el modelo actualizado se guarda automáticamente en `localStorage` sin acción adicional del usuario

#### Scenario: El modelo se restaura al recargar

- **WHEN** el usuario recarga la página con un modelo previamente guardado
- **THEN** el canvas se abre con el último modelo guardado (nodos, aristas y propiedades)

### Requirement: Exportación del modelo como JSON

El usuario SHALL poder exportar el modelo del proceso como un archivo JSON con los nodos, sus posiciones y propiedades, y las aristas.

#### Scenario: Exportar el modelo

- **WHEN** el usuario selecciona exportar
- **THEN** el editor descarga un archivo JSON que representa el modelo completo del proceso actual

### Requirement: Importación del modelo desde JSON

El usuario SHALL poder importar un modelo desde un archivo JSON válido para cargarlo en el canvas, reemplazando el modelo actual; ante un JSON inválido, el editor SHALL mostrar un mensaje de error y SHALL NOT modificar el modelo actual.

#### Scenario: Importar un modelo válido

- **WHEN** el usuario importa un archivo JSON válido del formato del proyecto
- **THEN** el canvas muestra los nodos, aristas y propiedades del modelo importado

#### Scenario: Importar un JSON inválido

- **WHEN** el usuario importa un archivo que no es un JSON válido del modelo
- **THEN** el editor muestra un mensaje de error
- **AND** el modelo actual permanece sin cambios

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
