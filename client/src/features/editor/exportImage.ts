/**
 * Exportación del diagrama como imagen (PNG/SVG) con `html-to-image` sobre
 * el elemento `.react-flow__viewport` del canvas.
 *
 * React Flow v12 ya no exporta `toPng`/`toSvg` desde el paquete core (ver
 * AD-013); con `getNodesBounds` + `getViewportForBounds` se encuadran todos
 * los nodos en una imagen de tamaño fijo con fondo blanco.
 */
import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

const IMAGE_WIDTH = 1024;
const IMAGE_HEIGHT = 768;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const PADDING = 0.1;

/** Formato de salida de la exportación. */
export type ImageFormat = "png" | "svg";

/**
 * Exporta el diagrama actual como PNG o SVG y lo descarga.
 *
 * @param format - "png" o "svg"
 * @param getNodes - devuelve los nodos actuales (de `useReactFlow().getNodes`)
 * @param domNode - elemento DOM del flow (de `useStoreApi().getState().domNode`)
 */
export async function exportDiagram(
  format: ImageFormat,
  getNodes: () => Node[],
  domNode: HTMLElement | null,
): Promise<void> {
  const viewportElement = domNode?.querySelector(".react-flow__viewport");
  if (!(viewportElement instanceof HTMLElement)) {
    throw new Error("El canvas todavía no está listo para exportar.");
  }

  const bounds = getNodesBounds(getNodes());
  const fitted = getViewportForBounds(
    bounds,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    MIN_ZOOM,
    MAX_ZOOM,
    PADDING,
  );

  const options = {
    backgroundColor: "#ffffff",
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    style: {
      width: `${IMAGE_WIDTH}px`,
      height: `${IMAGE_HEIGHT}px`,
      transform: `translate(${fitted.x}px, ${fitted.y}px) scale(${fitted.zoom})`,
    },
  };

  const dataUrl =
    format === "svg"
      ? await toSvg(viewportElement, options)
      : await toPng(viewportElement, options);

  downloadDataUrl(dataUrl, `proceso.${format}`);
}

/** Descarga una data URL con el nombre de archivo dado. */
function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}