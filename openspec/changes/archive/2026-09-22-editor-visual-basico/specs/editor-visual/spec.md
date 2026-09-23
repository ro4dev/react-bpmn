# Spec Delta

## Purpose

Editor visual de procesos de negocio en el navegador: permite dibujar un proceso con paleta de elementos, conexiones entre nodos, edición de propiedades y guardado del modelo de forma local.

## ADDED Requirements

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