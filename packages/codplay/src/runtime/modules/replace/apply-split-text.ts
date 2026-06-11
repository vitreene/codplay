import type { TransitionRequest } from "../../../animation/types";
import type { ReplaceCommand } from "./normalize-replace";
import { computeStaggerDelays } from "./stagger-order";

type TextSplitSession = {
  overlayOld: HTMLElement;
  overlayNew: HTMLElement | null;
  oldSpans: HTMLElement[];
  capturedText: string;
  splitMode: "letter" | "word" | "line";
  originalVisibility: string;
  parentPosition: string;
  parent: HTMLElement;
};

const activeTextSessions = new WeakMap<Element, TextSplitSession>();

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

function positionOverlay(overlay: HTMLElement, el: HTMLElement, parent: HTMLElement): void {
  const { left, top } = getOffsetFromParent(el, parent);
  overlay.style.position = "absolute";
  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
  overlay.style.width = `${el.offsetWidth}px`;
  overlay.style.margin = "0";
  overlay.style.pointerEvents = "none";
}

function buildSpans(tokens: string[], container: HTMLElement): HTMLElement[] {
  return tokens.map((token) => {
    const span = document.createElement("span");
    span.textContent = token;
    container.appendChild(span);
    return span;
  });
}

export function cancelSplitTextSession(el: HTMLElement): void {
  const session = activeTextSessions.get(el);
  if (session === undefined) return;
  activeTextSessions.delete(el);
  session.overlayOld.remove();
  session.overlayNew?.remove();
  el.style.visibility = session.originalVisibility;
  session.parent.style.position = session.parentPosition;
}

export function applySplitTextBefore(
  el: HTMLElement,
  parent: HTMLElement,
  splitMode: "letter" | "word" | "line"
): void {
  const originalParentPosition = parent.style.position;
  if (!parent.style.position || parent.style.position === "static") {
    parent.style.position = "relative";
  }

  const capturedText = el.textContent ?? "";
  const originalVisibility = el.style.visibility;

  // Overlay with old spans in normal inline flow — no absolute positioning on spans
  const overlayOld = el.cloneNode(false) as HTMLElement;
  overlayOld.removeAttribute("id");
  overlayOld.id = `${el.id}-split-old`;
  positionOverlay(overlayOld, el, parent);

  const oldTokens = tokenize(capturedText, splitMode);
  const oldSpans = buildSpans(oldTokens, overlayOld);

  parent.appendChild(overlayOld);
  el.style.visibility = "hidden";

  activeTextSessions.set(el, {
    overlayOld,
    overlayNew: null,
    oldSpans,
    capturedText,
    splitMode,
    originalVisibility,
    parentPosition: originalParentPosition,
    parent,
  });
}

export function applySplitTextAfter(input: {
  el: HTMLElement;
  command: ReplaceCommand;
  eventId: string;
  eventName: string;
  listenerId: string;
  persoId: string;
}): TransitionRequest[] {
  const { el, command, eventId, eventName, listenerId, persoId } = input;
  const session = activeTextSessions.get(el);
  if (session === undefined) return [];

  const { capturedText, splitMode, oldSpans, parent } = session;

  const newText = el.textContent ?? "";
  const oldTokens = tokenize(capturedText, splitMode);
  const newTokens = tokenize(newText, splitMode);
  const maxLen = Math.max(oldTokens.length, newTokens.length);

  // Build overlay with new spans in normal flow (same position as overlayOld).
  // Reset visibility: el has visibility:hidden at this point (set in beforeUpdate),
  // and cloneNode copies inline styles — overlayNew must be visible.
  const overlayNew = el.cloneNode(false) as HTMLElement;
  overlayNew.removeAttribute("id");
  overlayNew.id = `${el.id}-split-new`;
  overlayNew.style.visibility = "";
  positionOverlay(overlayNew, el, parent);
  const newSpans = buildSpans(newTokens, overlayNew);
  // Start new spans invisible
  newSpans.forEach((s) => { s.style.opacity = "0"; });

  parent.appendChild(overlayNew);
  session.overlayNew = overlayNew;

  // Both overlays are in the DOM at the same position — measure dx per position.
  // getClientRects()[0] is used instead of getBoundingClientRect() for inline
  // elements: it returns one rect per line-box fragment, which is precise for
  // individual character spans.
  const dxValues = newTokens.map((_, i) => {
    if (i < oldSpans.length) {
      const oldRect = oldSpans[i].getClientRects()[0];
      const newRect = newSpans[i].getClientRects()[0];
      if (oldRect === undefined || newRect === undefined) return 0;
      return oldRect.left - newRect.left;
    }
    return 0;
  });

  const { duration } = command;
  const ease = command.transition.ease;
  const totalStaggerMs = command.stagger ?? Math.round(duration * 0.4);

  const delays = computeStaggerDelays({
    cols: maxLen,
    rows: 1,
    totalStaggerMs,
    direction: command.direction,
  });

  // groupTotal: 1 (opacity) per old token + 2 (opacity + x) per new token
  const groupTotal = oldTokens.length + newTokens.length * 2;
  if (groupTotal === 0) return [];

  const groupId = `${eventId}-${persoId}-split`;

  const onGroupFinalize = (_reason: "completed" | "stopped") => {
    const s = activeTextSessions.get(el);
    if (s === undefined) return;
    activeTextSessions.delete(el);
    s.overlayOld.remove();
    s.overlayNew?.remove();
    el.style.visibility = s.originalVisibility;
    s.parent.style.position = s.parentPosition;
  };

  const requests: TransitionRequest[] = [];

  // Outro: old spans fade out in place
  for (let i = 0; i < oldTokens.length; i++) {
    requests.push({
      transitionId: `${groupId}-o-opacity-${i}`,
      eventId, eventName, listenerId,
      property: "opacity",
      target: oldSpans[i],
      from: undefined,
      to: 0,
      duration,
      ease,
      delayMs: delays[i],
      group: { id: groupId, total: groupTotal, onGroupFinalize },
    });
  }

  // Intro: new spans fade in and slide from the old char's position
  for (let i = 0; i < newTokens.length; i++) {
    requests.push({
      transitionId: `${groupId}-i-opacity-${i}`,
      eventId, eventName, listenerId,
      property: "opacity",
      target: newSpans[i],
      from: 0,
      to: 1,
      duration,
      ease,
      delayMs: delays[i],
      group: { id: groupId, total: groupTotal, onGroupFinalize },
    });

    requests.push({
      transitionId: `${groupId}-i-x-${i}`,
      eventId, eventName, listenerId,
      property: "x",
      target: newSpans[i],
      from: dxValues[i],
      to: 0,
      duration,
      ease,
      delayMs: delays[i],
      group: { id: groupId, total: groupTotal, onGroupFinalize },
    });
  }

  return requests;
}
