import type { TransitionRequest } from "../../../animation/types";
import type { ReplaceCommand } from "./normalize-replace";

export type ReplaceSimpleEmitter = {
  emit: (input: { name: string; payload: Record<string, unknown>; ms: number }) => void
  currentMs: () => number
}

type CloneSession = {
  cloneA: HTMLElement;
  cloneB: HTMLElement | null;
  originalVisibility: string;
  parentPosition: string;
  parent: HTMLElement;
};

const activeSessions = new WeakMap<Element, CloneSession>();

function getOffsetFromParent(el: HTMLElement, parent: HTMLElement): { left: number; top: number } {
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

function positionClone(clone: HTMLElement, el: HTMLElement, parent: HTMLElement): void {
  const { left, top } = getOffsetFromParent(el, parent);
  clone.style.position = "absolute";
  clone.style.left = `${left}px`;
  clone.style.top = `${top}px`;
  clone.style.width = `${el.offsetWidth}px`;
  clone.style.height = `${el.offsetHeight}px`;
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
}

function positionCloneNoSize(clone: HTMLElement, el: HTMLElement, parent: HTMLElement): void {
  const { left, top } = getOffsetFromParent(el, parent);
  clone.style.position = "absolute";
  clone.style.left = `${left}px`;
  clone.style.top = `${top}px`;
  clone.style.width = `${el.offsetWidth}px`;
  clone.style.margin = "0";
  clone.style.pointerEvents = "none";
}

function buildTransitionRequests(input: {
  target: HTMLElement;
  props: Record<string, { from?: number | string; to: number | string }>;
  duration: number;
  ease: string | undefined;
  eventId: string;
  eventName: string;
  listenerId: string;
  delayMs?: number;
  groupId: string;
  groupTotal: number;
  onGroupFinalize: (reason: "completed" | "stopped") => void;
}): TransitionRequest[] {
  return Object.entries(input.props).map(([property, value], idx) => ({
    transitionId: `replace-${input.groupId}-${property}-${idx}`,
    eventId: input.eventId,
    eventName: input.eventName,
    listenerId: input.listenerId,
    property,
    target: input.target,
    from: value.from,
    to: value.to,
    duration: input.duration,
    ease: input.ease,
    delayMs: input.delayMs,
    group: {
      id: input.groupId,
      total: input.groupTotal,
      onGroupFinalize: input.onGroupFinalize,
    },
  }));
}

export function applySimpleBefore(el: HTMLElement, parent: HTMLElement): void {
  const originalParentPosition = parent.style.position;

  if (!parent.style.position || parent.style.position === "static") {
    parent.style.position = "relative";
  }

  const cloneA = el.cloneNode(true) as HTMLElement;
  cloneA.removeAttribute("id");
  cloneA.id = `${el.id}-clone-outro`;
  parent.appendChild(cloneA);
  positionClone(cloneA, el, parent);

  const session: CloneSession = {
    cloneA,
    cloneB: null,
    originalVisibility: el.style.visibility,
    parentPosition: originalParentPosition,
    parent,
  };

  el.style.visibility = "hidden";
  activeSessions.set(el, session);
}

export function applySimpleAfter(input: {
  el: HTMLElement;
  command: ReplaceCommand;
  eventId: string;
  eventName: string;
  listenerId: string;
  persoId: string;
  circuit: "sync" | "async";
  emitter: ReplaceSimpleEmitter;
}): TransitionRequest[] {
  const { el, command, eventId, eventName, listenerId, persoId, circuit, emitter } = input;
  const session = activeSessions.get(el);
  if (session === undefined) return [];

  el.style.visibility = session.originalVisibility;
  const cloneB = el.cloneNode(true) as HTMLElement;
  el.style.visibility = "hidden";

  cloneB.removeAttribute("id");
  cloneB.id = `${el.id}-clone-intro`;
  session.parent.appendChild(cloneB);
  session.cloneB = cloneB;

  if (circuit === "sync") {
    positionClone(cloneB, el, session.parent);
  } else {
    positionCloneNoSize(cloneB, el, session.parent);
    const imgB = cloneB.querySelector("img");
    if (imgB !== null) {
      imgB.addEventListener(
        "load",
        () => {
          cloneB.style.width = `${cloneB.offsetWidth}px`;
          cloneB.style.height = `${cloneB.offsetHeight}px`;
          emitter.emit({
            name: "replace:dimensions-ready",
            payload: { persoId, width: cloneB.offsetWidth, height: cloneB.offsetHeight },
            ms: emitter.currentMs(),
          });
        },
        { once: true },
      );
    }
  }

  const groupId = `${eventId}-${persoId}`;
  const { transition, duration } = command;

  const outroKeys = Object.keys(transition.outro);
  const introKeys = Object.keys(transition.intro);
  const groupTotal = outroKeys.length + introKeys.length;
  if (groupTotal === 0) return [];

  const onGroupFinalize = (_reason: "completed" | "stopped") => {
    const s = activeSessions.get(el);
    if (s === undefined) return;
    activeSessions.delete(el);
    s.cloneA.remove();
    s.cloneB?.remove();
    el.style.visibility = s.originalVisibility;
    s.parent.style.position = s.parentPosition;
  };

  const outroRequests = buildTransitionRequests({
    target: session.cloneA,
    props: transition.outro,
    duration,
    ease: transition.ease,
    eventId,
    eventName,
    listenerId,
    groupId,
    groupTotal,
    onGroupFinalize,
  });

  const introRequests = buildTransitionRequests({
    target: cloneB,
    props: transition.intro,
    duration,
    ease: transition.ease,
    eventId,
    eventName,
    listenerId,
    groupId,
    groupTotal,
    onGroupFinalize,
  });

  return [...outroRequests, ...introRequests];
}

export function applyCloneBDimensions(el: HTMLElement, width: number, height: number): void {
  const session = activeSessions.get(el);
  if (session === undefined || session.cloneB === null) return;
  session.cloneB.style.width = `${width}px`;
  session.cloneB.style.height = `${height}px`;
}

export function cancelSimpleSession(el: HTMLElement): void {
  const session = activeSessions.get(el);
  if (session === undefined) return;
  activeSessions.delete(el);
  session.cloneA.remove();
  session.cloneB?.remove();
  el.style.visibility = session.originalVisibility;
  session.parent.style.position = session.parentPosition;
}
