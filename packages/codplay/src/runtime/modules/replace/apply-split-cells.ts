import type { TransitionRequest } from "../../../animation/types";
import type { ReplaceCommand } from "./normalize-replace";
import { computeStaggerDelays } from "./stagger-order";

const DEFAULT_COLS = 4;
const DEFAULT_ROWS = 3;

type ObjectFitRect = {
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
};

type CellsSession = {
  overlay: HTMLElement;
  aCells: HTMLElement[];
  bCells: HTMLElement[];
  cols: number;
  rows: number;
  containerW: number;
  containerH: number;
  objectFitMode: "cover" | "contain";
  originalVisibility: string;
  parentPosition: string;
  parent: HTMLElement;
};

export type CellsEmitter = {
  emit: (input: { name: string; payload: Record<string, unknown>; ms: number }) => void;
  currentMs: () => number;
};

const activeCellsSessions = new WeakMap<Element, CellsSession>();

function getOffsetFromParent(
  el: HTMLElement,
  parent: HTMLElement
): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = el;
  while (current !== null && current !== parent) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { left, top };
}

function computeObjectFitRect(
  naturalW: number,
  naturalH: number,
  containerW: number,
  containerH: number,
  fit: "cover" | "contain"
): ObjectFitRect {
  if (naturalW === 0 || naturalH === 0) {
    return { renderedW: containerW, renderedH: containerH, offsetX: 0, offsetY: 0 };
  }
  const scale =
    fit === "cover"
      ? Math.max(containerW / naturalW, containerH / naturalH)
      : Math.min(containerW / naturalW, containerH / naturalH);
  const renderedW = naturalW * scale;
  const renderedH = naturalH * scale;
  const offsetX = (containerW - renderedW) / 2;
  const offsetY = (containerH - renderedH) / 2;
  return { renderedW, renderedH, offsetX, offsetY };
}

function buildCells(
  overlay: HTMLElement,
  src: string,
  cols: number,
  rows: number,
  containerW: number,
  containerH: number,
  rect: ObjectFitRect
): HTMLElement[] {
  const cellW = containerW / cols;
  const cellH = containerH / rows;
  const { renderedW, renderedH, offsetX, offsetY } = rect;
  const cells: HTMLElement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = document.createElement("div");
      cell.style.position = "absolute";
      cell.style.left = `${col * cellW}px`;
      cell.style.top = `${row * cellH}px`;
      cell.style.width = `${cellW}px`;
      cell.style.height = `${cellH}px`;
      cell.style.backgroundImage = `url(${src})`;
      cell.style.backgroundSize = `${renderedW}px ${renderedH}px`;
      cell.style.backgroundPosition = `${offsetX - col * cellW}px ${offsetY - row * cellH}px`;
      cell.style.backgroundRepeat = "no-repeat";
      overlay.appendChild(cell);
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * Applies one object-fit rect (background size + per-cell offset) to one list of cells.
 */
function applyRectToCells(
  cells: HTMLElement[],
  cols: number,
  rows: number,
  containerW: number,
  containerH: number,
  rect: ObjectFitRect
): void {
  const cellW = containerW / cols;
  const cellH = containerH / rows;
  const { renderedW, renderedH, offsetX, offsetY } = rect;
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = cells[i++];
      if (cell === undefined) continue;
      cell.style.backgroundSize = `${renderedW}px ${renderedH}px`;
      cell.style.backgroundPosition = `${offsetX - col * cellW}px ${offsetY - row * cellH}px`;
    }
  }
}

export function applyCellsBRect(
  el: HTMLElement,
  rect: { renderedW: number; renderedH: number; offsetX: number; offsetY: number }
): void {
  const session = activeCellsSessions.get(el);
  if (session === undefined || session.bCells.length === 0) return;
  applyRectToCells(session.bCells, session.cols, session.rows, session.containerW, session.containerH, rect);
}

export function cancelSplitCellsSession(el: HTMLElement): void {
  const session = activeCellsSessions.get(el);
  if (session === undefined) return;
  activeCellsSessions.delete(el);
  session.overlay.remove();
  el.style.visibility = session.originalVisibility;
  session.parent.style.position = session.parentPosition;
}

export function applySplitCellsBefore(
  el: HTMLElement,
  parent: HTMLElement,
  src: string,
  command: ReplaceCommand
): void {
  const originalParentPosition = parent.style.position;
  if (!parent.style.position || parent.style.position === "static") {
    parent.style.position = "relative";
  }

  const imgEl = el.querySelector<HTMLImageElement>("img");
  const refEl = imgEl ?? el;
  const containerW = refEl.offsetWidth;
  const containerH = refEl.offsetHeight;
  const originalVisibility = el.style.visibility;

  const { left, top } = getOffsetFromParent(refEl, parent);

  const objectFitMode: "cover" | "contain" =
    imgEl !== null && getComputedStyle(imgEl).objectFit === "contain" ? "contain" : "cover";

  const cols = command.cellX ?? DEFAULT_COLS;
  const rows = command.cellY ?? DEFAULT_ROWS;

  // L'image A (l'image courante) ne doit pas être mesurée tant qu'elle n'est pas prête :
  // une lecture de naturalWidth sur une image non décodée renvoie 0 et produit un rect
  // étiré, jamais corrigé. Si elle est prête, on calcule tout de suite ; sinon on construit
  // les cellules A avec un rect provisoire (remplissage du conteneur) et on les corrige au
  // load, comme pour les cellules B.
  const imgReady = imgEl !== null && imgEl.complete && imgEl.naturalWidth > 0;
  const aRect = imgReady
    ? computeObjectFitRect(imgEl.naturalWidth, imgEl.naturalHeight, containerW, containerH, objectFitMode)
    : { renderedW: containerW, renderedH: containerH, offsetX: 0, offsetY: 0 };

  const overlay = document.createElement("div");
  overlay.id = `${el.id}-cells-overlay`;
  overlay.style.position = "absolute";
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
  overlay.style.width = `${containerW}px`;
  overlay.style.height = `${containerH}px`;
  overlay.style.overflow = "hidden";
  overlay.style.pointerEvents = "none";

  const aCells = buildCells(overlay, src, cols, rows, containerW, containerH, aRect);

  parent.appendChild(overlay);
  el.style.visibility = "hidden";

  activeCellsSessions.set(el, {
    overlay,
    aCells,
    bCells: [],
    cols,
    rows,
    containerW,
    containerH,
    objectFitMode,
    originalVisibility,
    parentPosition: originalParentPosition,
    parent,
  });

  // Image A pas encore prête : corriger la géométrie des cellules A dès qu'elle est décodée,
  // si la session est toujours active (la transition peut s'être terminée entre-temps).
  if (!imgReady && imgEl !== null) {
    imgEl.addEventListener(
      "load",
      () => {
        const session = activeCellsSessions.get(el);
        if (session === undefined || session.aCells !== aCells) return;
        const rect = computeObjectFitRect(
          imgEl.naturalWidth,
          imgEl.naturalHeight,
          containerW,
          containerH,
          objectFitMode
        );
        applyRectToCells(aCells, cols, rows, containerW, containerH, rect);
      },
      { once: true }
    );
  }
}

export function applySplitCellsAfter(input: {
  el: HTMLElement;
  command: ReplaceCommand;
  eventId: string;
  eventName: string;
  listenerId: string;
  persoId: string;
  emitter: CellsEmitter;
}): TransitionRequest[] {
  const { el, command, eventId, eventName, listenerId, persoId, emitter } = input;
  const session = activeCellsSessions.get(el);
  if (session === undefined) return [];

  const { overlay, aCells, cols, rows, containerW, containerH, objectFitMode } = session;
  const { transition, duration } = command;

  const newSrc = el.querySelector<HTMLImageElement>("img")?.src ?? "";

  // B cells built with placeholder rect — corrected async once new image loads
  const placeholder: ObjectFitRect = { renderedW: containerW, renderedH: containerH, offsetX: 0, offsetY: 0 };
  const bCells = buildCells(overlay, newSrc, cols, rows, containerW, containerH, placeholder);
  session.bCells = bCells;

  const tmpImg = new Image();
  tmpImg.addEventListener(
    "load",
    () => {
      const rect = computeObjectFitRect(
        tmpImg.naturalWidth,
        tmpImg.naturalHeight,
        containerW,
        containerH,
        objectFitMode
      );
      applyCellsBRect(el, rect);
      emitter.emit({
        name: "replace:cells-rect-ready",
        payload: {
          persoId,
          renderedW: rect.renderedW,
          renderedH: rect.renderedH,
          offsetX: rect.offsetX,
          offsetY: rect.offsetY,
        },
        ms: emitter.currentMs(),
      });
    },
    { once: true }
  );
  tmpImg.src = newSrc;

  const totalStaggerMs = command.stagger ?? Math.round(duration * 0.5);
  const delays = computeStaggerDelays({
    cols,
    rows,
    totalStaggerMs,
    direction: command.direction,
  });

  const outroProps = Object.keys(transition.outro);
  const introProps = Object.keys(transition.intro);
  const groupTotal = aCells.length * outroProps.length + bCells.length * introProps.length;

  if (groupTotal === 0) return [];

  const groupId = `${eventId}-${persoId}-cells`;

  const onGroupFinalize = (_reason: "completed" | "stopped") => {
    const s = activeCellsSessions.get(el);
    if (s === undefined) return;
    activeCellsSessions.delete(el);
    s.overlay.remove();
    s.parent.style.position = s.parentPosition;
    el.style.visibility = s.originalVisibility;
  };

  const requests: TransitionRequest[] = [];

  for (let i = 0; i < aCells.length; i++) {
    for (const [property, value] of Object.entries(transition.outro)) {
      requests.push({
        transitionId: `${groupId}-o-${property}-${i}`,
        eventId,
        eventName,
        listenerId,
        property,
        target: aCells[i],
        from: value.from,
        to: value.to,
        duration,
        ease: transition.ease,
        delayMs: delays[i],
        group: { id: groupId, total: groupTotal, onGroupFinalize },
      });
    }
  }

  for (let i = 0; i < bCells.length; i++) {
    for (const [property, value] of Object.entries(transition.intro)) {
      requests.push({
        transitionId: `${groupId}-i-${property}-${i}`,
        eventId,
        eventName,
        listenerId,
        property,
        target: bCells[i],
        from: value.from,
        to: value.to,
        duration,
        ease: transition.ease,
        delayMs: delays[i],
        group: { id: groupId, total: groupTotal, onGroupFinalize },
      });
    }
  }

  return requests;
}
