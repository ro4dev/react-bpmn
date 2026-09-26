/**
 * Tests del diff semántico de grafo (`src/lib/model/diff.ts`).
 *
 * Es la lógica que decide qué muestra el panel de historial, y antes de la Fase 4
 * solo estaba cubierta de forma indirecta (si el panel se rompía, el proceso
 * igual guardaba bien). Corre sin dependencias: `node:test` + `--experimental-strip-types`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { describeDiff, diffModels, type ModelDiff } from "../src/lib/model/diff.ts";

// Los tipos se infieren de la firma de `diffModels` en vez de importarse de
// `@shared/...`: node corre el archivo con type-stripping y no resuelve el alias
// por paths, mientras que `Parameters<>` no necesita ninguna configuración.
type ProcessModel = Parameters<typeof diffModels>[0];
type ProcessNode = ProcessModel["nodes"][number];
type ProcessEdge = ProcessModel["edges"][number];

function node(id: string, over: Partial<ProcessNode> = {}): ProcessNode {
  return {
    id,
    kind: "task",
    label: `Nodo ${id}`,
    position: { x: 0, y: 0 },
    props: {},
    ...over,
  };
}

function edge(source: string, target: string, over: Partial<ProcessEdge> = {}): ProcessEdge {
  return { id: `${source}-${target}`, source, target, ...over };
}

function model(nodes: ProcessNode[], edges: ProcessEdge[] = []): ProcessModel {
  return { version: 1, nodes, edges };
}

const v1 = model(
  [node("a"), node("b"), node("c")],
  [edge("a", "b"), edge("b", "c")],
);

test("modelos idénticos no reportan cambios", () => {
  const diff = diffModels(v1, v1);
  assert.equal(diff.nodes.length, 0);
  assert.equal(diff.edges.length, 0);
  assert.equal(describeDiff(diff), "Sin cambios");
});

test("detecta nodos agregados y eliminados", () => {
  const diff = diffModels(v1, model([node("a"), node("c")], [edge("a", "c")]));
  assert.deepEqual(diff.nodes.map((c) => [c.kind, c.node.id]), [["removed", "b"]]);
  // Ambas aristas originales desaparecen: a→b y b→c. La nueva es a→c.
  assert.deepEqual(diff.edges.map((c) => [c.kind, c.edge.source, c.edge.target]), [
    ["removed", "a", "b"],
    ["removed", "b", "c"],
    ["added", "a", "c"],
  ]);
  assert.equal(diff.summary.removed, 1);
  assert.equal(diff.summary.edgesAdded, 1);
  assert.equal(diff.summary.edgesRemoved, 2);
});

test("un nodo nuevo se reporta como added", () => {
  const diff = diffModels(v1, model([...v1.nodes, node("d")], v1.edges));
  assert.deepEqual(diff.nodes.map((c) => [c.kind, c.node.id]), [["added", "d"]]);
  assert.equal(diff.summary.added, 1);
});

test("cambiar el label se reporta como changed con el campo", () => {
  const next = model(v1.nodes.map((n) => (n.id === "b" ? node("b", { label: "Revisar" }) : n)), v1.edges);
  const change = diffModels(v1, next).nodes[0];
  assert.equal(change.kind, "changed");
  assert.deepEqual(change.fields, ["label"]);
});

test("cambiar props reporta el nombre del prop", () => {
  const next = model(
    v1.nodes.map((n) => (n.id === "b" ? node("b", { props: { description: "revisar", assignee: "Ana" } }) : n)),
    v1.edges,
  );
  const change = diffModels(v1, next).nodes[0];
  assert.equal(change.kind, "changed");
  assert.deepEqual(change.fields, ["description", "assignee"]);
});

test("props ausentes y vacíos se consideran iguales", () => {
  // `props: {}` y `props: { description: "" }` no son un cambio real: si no, el
  // panel llenaría el diff de ruido en cada guardado.
  const next = model(v1.nodes.map((n) => (n.id === "b" ? node("b", { props: { description: "" } }) : n)), v1.edges);
  assert.equal(diffModels(v1, next).nodes.length, 0);
});

test("mover un nodo se reporta como moved con la posición anterior", () => {
  const next = model(
    v1.nodes.map((n) => (n.id === "b" ? node("b", { position: { x: 120, y: 40 } }) : n)),
    v1.edges,
  );
  const change = diffModels(v1, next).nodes[0];
  assert.equal(change.kind, "moved");
  assert.deepEqual(change.previousPosition, { x: 0, y: 0 });
  assert.deepEqual(change.node.position, { x: 120, y: 40 });
});

test("cambiar el label tiene prioridad sobre haberlo movido", () => {
  // Decisión de diseño: `changed` y `moved` son excluyentes. Si un nodo cambió de
  // contenido, mostrar solo el movimiento taparía el cambio que más importa.
  const next = model(
    v1.nodes.map((n) => (n.id === "b" ? node("b", { label: "Revisar", position: { x: 120, y: 40 } }) : n)),
    v1.edges,
  );
  const change = diffModels(v1, next).nodes[0];
  assert.equal(change.kind, "changed");
  assert.deepEqual(change.fields, ["label"]);
  assert.equal(change.previousPosition, undefined);
});

test("las aristas se comparan por source→target, no por id", () => {
  // Al recargar desde el server el id de la arista puede cambiar; si el diff
  // usara el id, cada guardado aparecería como "1 arista eliminada + 1 agregada".
  const next = model(v1.nodes, [edge("a", "b", { id: "otro-id" }), edge("b", "c", { id: "tercer-id" })]);
  const diff = diffModels(v1, next);
  assert.equal(diff.edges.length, 0);
  assert.equal(describeDiff(diff), "Sin cambios");
});

test("comparar contra el modelo vacío marca todo como agregado", () => {
  // Es lo que muestra la v1 del historial: no hay versión previa.
  const diff = diffModels(model([]), v1);
  assert.equal(diff.summary.added, 3);
  assert.equal(diff.summary.removed, 0);
  assert.equal(diff.summary.edgesAdded, 2);
});

test("describeDiff pluraliza y separa con puntos", () => {
  const diff = diffModels(
    v1,
    model([node("a"), node("c"), node("d")], [edge("a", "c"), edge("b", "c")]),
  );
  const text: string = describeDiff(diff);
  assert.ok(text.includes("+1 nodo"), text);
  assert.ok(text.includes("-1 nodo"), text);
  assert.ok(text.includes("+1 arista"), text);
  assert.ok(text.includes("-1 arista"), text);
});

test("el resumen coincide con el detalle", () => {
  const next = model(
    [
      node("a"),
      node("b", { label: "Revisar" }),
      node("c", { position: { x: 9, y: 9 } }),
      node("d"),
    ],
    [edge("a", "b")],
  );
  const diff: ModelDiff = diffModels(v1, next);
  assert.equal(diff.summary.added, 1);
  assert.equal(diff.summary.changed, 1);
  assert.equal(diff.summary.moved, 1);
  assert.equal(diff.summary.removed, 0);
  assert.equal(diff.summary.edgesRemoved, 1);
  assert.equal(diff.next, next);
});
