import type { TransitionRequest } from "../../../animation/types";
import type { SlotConfig } from "../../config/transitions";
import type { ReplaceCommand } from "./normalize-replace";
import { computeStaggerDelays } from "./stagger-order";

/**
 * Rendu « machine à sous » (slot) pour replace-split-text.
 *
 * Adaptation de https://github.com/Danilaa1/slot-text : chaque caractère est une
 * cellule clippée (`overflow:hidden`) de hauteur H contenant l'ancien et le nouveau
 * glyphe empilés ; un `translateY` opposé sur les deux faces produit le roulement
 * vertical. Stagger + wobble déterministe par caractère, easing à ressort, flash
 * chromatique optionnel.
 */

type SlotSession = {
  overlay: HTMLElement | null;
  cellH: number;
  capturedText: string;
  splitMode: "letter" | "word" | "line";
  restColor: string;
  originalVisibility: string;
  parentPosition: string;
  parent: HTMLElement;
};

const activeSlotSessions = new WeakMap<Element, SlotSession>();

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

function tokenize(text: string, mode: "letter" | "word" | "line"): string[] {
  if (mode === "line") return text.split("\n");
  if (mode === "word") return text.split(/(\s+)/).filter((p) => p.length > 0);
  return [...text];
}

/**
 * Hauteur d'une cellule : line-height calculé, repli sur la hauteur rendue puis
 * sur la taille de police.
 */
function resolveCellHeight(el: HTMLElement): number {
  const cs = globalThis.getComputedStyle?.(el);
  if (cs !== undefined) {
    const lineHeight = parseFloat(cs.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
    const rectH = el.getBoundingClientRect().height;
    if (rectH > 0) return rectH;
    const fontSize = parseFloat(cs.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) return fontSize * 1.2;
  }
  const rectH = el.getBoundingClientRect().height;
  return rectH > 0 ? rectH : 16;
}

/**
 * Bruit déterministe sin-hash repris de slot-text : renvoie une valeur dans [-1, 1]
 * stable pour un index donné. Indispensable pour que le seek reconstruise la même
 * animation (durées/délais identiques au rejeu).
 */
function wobble(index: number, salt: number): number {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export function cancelSlotTextSession(el: HTMLElement): void {
  const session = activeSlotSessions.get(el);
  if (session === undefined) return;
  activeSlotSessions.delete(el);
  session.overlay?.remove();
  el.style.visibility = session.originalVisibility;
  session.parent.style.position = session.parentPosition;
}

export function applySlotTextBefore(
  el: HTMLElement,
  parent: HTMLElement,
  splitMode: "letter" | "word" | "line"
): void {
  const originalParentPosition = parent.style.position;
  if (!parent.style.position || parent.style.position === "static") {
    parent.style.position = "relative";
  }

  const cs = globalThis.getComputedStyle?.(el);
  const restColor = cs?.color ?? "";

  activeSlotSessions.set(el, {
    overlay: null,
    cellH: resolveCellHeight(el),
    capturedText: el.textContent ?? "",
    splitMode,
    restColor,
    originalVisibility: el.style.visibility,
    parentPosition: originalParentPosition,
    parent,
  });

  el.style.visibility = "hidden";
}

function buildCell(cellH: number): HTMLElement {
  const cell = document.createElement("span");
  cell.style.display = "inline-block";
  cell.style.position = "relative";
  cell.style.overflow = "hidden";
  cell.style.height = `${cellH}px`;
  cell.style.verticalAlign = "top";
  cell.style.whiteSpace = "pre";
  return cell;
}

function buildFace(text: string, translateY: number, color?: string): HTMLElement {
  const face = document.createElement("span");
  face.textContent = text;
  face.style.position = "absolute";
  face.style.left = "0";
  face.style.top = "0";
  face.style.whiteSpace = "pre";
  face.style.transform = `translateY(${translateY}px)`;
  if (color !== undefined) face.style.color = color;
  return face;
}

export function applySlotTextAfter(input: {
  el: HTMLElement;
  command: ReplaceCommand;
  slot: SlotConfig;
  eventId: string;
  eventName: string;
  listenerId: string;
  persoId: string;
}): TransitionRequest[] {
  const { el, command, slot, eventId, eventName, listenerId, persoId } = input;
  const session = activeSlotSessions.get(el);
  if (session === undefined) return [];

  const { capturedText, splitMode, cellH, restColor, parent } = session;

  const oldTokens = tokenize(capturedText, splitMode);
  const newTokens = tokenize(el.textContent ?? "", splitMode);
  const maxLen = Math.max(oldTokens.length, newTokens.length);
  if (maxLen === 0) {
    cancelSlotTextSession(el);
    return [];
  }

  const { left, top } = getOffsetFromParent(el, parent);
  const overlay = el.cloneNode(false) as HTMLElement;
  overlay.removeAttribute("id");
  overlay.id = `${el.id}-slot`;
  overlay.style.position = "absolute";
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
  overlay.style.width = `${el.offsetWidth}px`;
  overlay.style.margin = "0";
  overlay.style.visibility = "";
  overlay.style.whiteSpace = "pre";
  overlay.style.pointerEvents = "none";
  overlay.textContent = "";

  const bounce = slot.bounce ?? 0;
  const exitDir = slot.axis === "up" ? -1 : 1; // sens de sortie de l'ancien glyphe
  const { duration } = command;
  const ease = command.transition.ease;
  const skipUnchanged = command.skipUnchanged ?? true;
  const totalStaggerMs = command.stagger ?? Math.round(duration * 0.5);

  const delays = computeStaggerDelays({
    cols: maxLen,
    rows: 1,
    totalStaggerMs,
    direction: command.direction,
  });

  type FaceSpec = {
    target: HTMLElement;
    from: number;
    to: number;
    durationMs: number;
    delayMs: number;
    color?: { from: string; to: string };
  };
  const faceSpecs: FaceSpec[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldChar = oldTokens[i] ?? "";
    const newChar = newTokens[i] ?? "";

    // Cellule statique : glyphe identique conservé sans animation.
    if (skipUnchanged && oldChar !== "" && oldChar === newChar) {
      const cell = buildCell(cellH);
      const sizer = document.createElement("span");
      sizer.textContent = newChar;
      cell.appendChild(sizer);
      overlay.appendChild(cell);
      continue;
    }

    const cell = buildCell(cellH);

    // Sizer invisible : fixe la largeur de la cellule sur le glyphe final.
    const sizer = document.createElement("span");
    sizer.textContent = newChar !== "" ? newChar : oldChar !== "" ? oldChar : " ";
    sizer.style.visibility = "hidden";
    cell.appendChild(sizer);

    // bounce === 0 (défaut) → timing régulier : durée uniforme, stagger linéaire,
    // faces synchronisées. bounce > 0 réintroduit la variation par glyphe à la slot-text.
    const isTail = newChar === ""; // glyphe qui roule vers le vide
    const durationMs =
      bounce > 0
        ? Math.max(80, Math.round(duration * (isTail ? 0.75 : 1) * (1 + bounce * 0.45 * wobble(i, 1))))
        : duration;
    const baseDelay =
      bounce > 0 ? Math.max(0, Math.round(delays[i] * (1 + bounce * 0.25 * wobble(i, 2)))) : delays[i];

    if (oldChar !== "") {
      const oldFace = buildFace(oldChar, 0);
      cell.appendChild(oldFace);
      faceSpecs.push({
        target: oldFace,
        from: 0,
        to: exitDir * cellH,
        durationMs,
        delayMs: baseDelay,
      });
    }

    if (newChar !== "") {
      const hasChroma = slot.chroma === true && restColor !== "";
      const startColor = hasChroma
        ? `hsl(${Math.round((i / Math.max(1, maxLen - 1)) * 300)}, 90%, 60%)`
        : undefined;
      const newFace = buildFace(newChar, -exitDir * cellH, startColor);
      cell.appendChild(newFace);
      // bounce > 0 : la nouvelle face « poursuit » l'ancienne (léger décalage). bounce 0 : synchronisées.
      const exitOffset = bounce > 0 ? Math.round(durationMs * 0.12) : 0;
      faceSpecs.push({
        target: newFace,
        from: -exitDir * cellH,
        to: 0,
        durationMs,
        delayMs: baseDelay + exitOffset,
        color: hasChroma ? { from: startColor as string, to: restColor } : undefined,
      });
    }

    overlay.appendChild(cell);
  }

  parent.appendChild(overlay);
  session.overlay = overlay;

  const groupTotal = faceSpecs.reduce(
    (total, spec) => total + 1 + (spec.color !== undefined ? 1 : 0),
    0
  );
  if (groupTotal === 0) {
    cancelSlotTextSession(el);
    return [];
  }

  const groupId = `${eventId}-${persoId}-slot`;
  const onGroupFinalize = (_reason: "completed" | "stopped") => {
    const s = activeSlotSessions.get(el);
    if (s === undefined) return;
    activeSlotSessions.delete(el);
    s.overlay?.remove();
    el.style.visibility = s.originalVisibility;
    s.parent.style.position = s.parentPosition;
  };

  const requests: TransitionRequest[] = [];
  faceSpecs.forEach((spec, idx) => {
    requests.push({
      transitionId: `${groupId}-y-${idx}`,
      eventId,
      eventName,
      listenerId,
      property: "y",
      target: spec.target,
      from: spec.from,
      to: spec.to,
      duration: spec.durationMs,
      ease,
      delayMs: spec.delayMs,
      group: { id: groupId, total: groupTotal, onGroupFinalize },
    });

    if (spec.color !== undefined) {
      requests.push({
        transitionId: `${groupId}-color-${idx}`,
        eventId,
        eventName,
        listenerId,
        property: "color",
        target: spec.target,
        from: spec.color.from,
        to: spec.color.to,
        duration: spec.durationMs,
        ease,
        delayMs: spec.delayMs,
        group: { id: groupId, total: groupTotal, onGroupFinalize },
      });
    }
  });

  return requests;
}
