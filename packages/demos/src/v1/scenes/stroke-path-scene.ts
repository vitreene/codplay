import type { StrapCollection } from "codplay-v1/player/strap-types";
import type { CaptureInitFn, CaptureTrackFn, PointerCaptureSample } from "codplay-v1/runtime/capture-types";
import type { SceneDoc } from "codplay-v1/player/types";

type LocalPoint = { x: number; y: number };
type StrokeCaptureState = { points: LocalPoint[]; color: string; originX: number; originY: number };
type StrokeStoryState = { areaLeft: number; areaTop: number; nextStrokeId: number };
export type StoredStroke = { id: string; d: string; color: string };

const STROKE_STORY_ID = "stroke-path-story";

function randomStrokeColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 75%, 45%)`;
}

// Couleur tirée une seule fois à l'ouverture du geste (pas à chaque tick, pas
// une seconde fois à la fin) : `trackCommand` (dessin live) et le strap final
// doivent dessiner dans la même couleur — voir `captureState.color` ci-dessous.
// `originX`/`originY` : offset écran de `strokeArea`, mesuré une seule fois
// (côté démo, hors du contrat de capture — voir `stroke-path-demo.ts`) et lu
// depuis `state` ici, jamais recalculé pendant le geste. Un ancrage au premier
// point (essayé plus tôt) évite le jitter mais laisse le tracé démarrer à
// l'origine locale de `strokeLive`, pas sous le pointeur : ce `state.areaLeft/
// areaTop` est ce qui manquait pour que `clientX/Y - origin` corresponde à la
// vraie position dans le SVG.
const initStrokeCaptureState: CaptureInitFn = ({ state }) => {
  const storyState = state as StrokeStoryState;
  return { points: [], color: randomStrokeColor(), originX: storyState.areaLeft, originY: storyState.areaTop };
};

// 1 chiffre après la virgule suffit visuellement et évite un `d` inutilement
// long (les coordonnées brutes, en sous-pixel, trainaient ~10 décimales).
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Distance perpendiculaire d'un point à la droite (lineStart, lineEnd) —
// brique de base de Douglas-Peucker.
function perpendicularDistance(point: LocalPoint, lineStart: LocalPoint, lineEnd: LocalPoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return numerator / Math.hypot(dx, dy);
}

// Distance minimale (px) entre deux points consécutifs conservés, appliquée
// AVANT Douglas-Peucker. RDP seul ne mesure que l'écart perpendiculaire à la
// corde (premier-dernier point du segment récursif) : un geste lent produit
// des points très rapprochés le long d'une vraie courbe, que RDP conserve
// tous puisqu'ils contribuent réellement à la forme — même si une résolution
// bien plus grossière resterait indissociable à l'oeil. Ce pré-filtre retire
// la densité inutile indépendamment de la forme, RDP retire ensuite les
// points quasi-alignés le long des segments qui restent.
const MIN_POINT_DISTANCE = 4;

// Tolérance en px (repère local, non mis à l'échelle) : un point n'est retiré
// que s'il s'écarte de moins de RDP_EPSILON de la droite qui le contournerait.
const RDP_EPSILON = 2.5;

// Ne garde un point que s'il est à au moins `minDistance` du dernier point
// conservé — le premier et le dernier point du tracé sont toujours gardés.
function filterByMinDistance(points: LocalPoint[], minDistance: number): LocalPoint[] {
  if (points.length < 3) return points;

  const filtered: LocalPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const last = filtered[filtered.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDistance) {
      filtered.push(points[i]);
    }
  }
  filtered.push(points[points.length - 1]);
  return filtered;
}

// Réduction Douglas-Peucker : ne s'applique qu'au commit final
// (`stroke-build-path`), jamais pendant le tracking — recalculer une
// simplification à chaque tick ferait bouger les points déjà tracés d'un
// tick à l'autre (même défaut que la bounding box récursive abandonnée plus
// haut), sans bénéfice puisque le dessin live n'est de toute façon jamais
// matérialisé (règle 4, v1-capture-spec.md).
function reducePoints(points: LocalPoint[], epsilon: number): LocalPoint[] {
  if (points.length < 3) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let splitIndex = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= epsilon) {
    return [first, last];
  }

  const left = reducePoints(points.slice(0, splitIndex + 1), epsilon);
  const right = reducePoints(points.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

// Lisse le tracé en courbes quadratiques (chaque point brut sert de point de
// contrôle, la courbe se termine au milieu du segment suivant) plutôt qu'en
// segments droits — évite les angles cassés d'un tracé point-à-point brut.
function buildSmoothPath(points: LocalPoint[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M${round1(points[0].x)} ${round1(points[0].y)} L${round1(points[1].x)} ${round1(points[1].y)}`;
  }

  let d = `M${round1(points[0].x)} ${round1(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = round1((curr.x + next.x) / 2);
    const midY = round1((curr.y + next.y) / 2);
    d += ` Q${round1(curr.x)} ${round1(curr.y)} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L${round1(last.x)} ${round1(last.y)}`;
  return d;
}

// Dessin live : recalcule le `d` complet à chaque tick et le pousse comme
// `CaptureAction` sur `strokeLive` — toujours en pure donnée (règle 5/7 de
// v1-capture-spec.md), jamais d'accès node ici (l'accès node a eu lieu une
// fois, ailleurs, voir `initStrokeCaptureState`). Cet effet n'est jamais
// matérialisé ni rejoué au seek (règle 4) ; seul le commit du strap l'est.
const trackStroke: CaptureTrackFn = ({ sample, captureState }) => {
  const p = sample as PointerCaptureSample;
  const state = captureState as StrokeCaptureState;
  const points = [...state.points, { x: p.clientX - state.originX, y: p.clientY - state.originY }];
  const nextCaptureState: StrokeCaptureState = { ...state, points };

  if (points.length < 2) {
    return { captureState: nextCaptureState };
  }

  return {
    captureState: nextCaptureState,
    action: { actionName: "stroke_tracking", data: { attr: { d: buildSmoothPath(points), stroke: state.color } } },
  };
};

// Straps de story : le commit ajoute un tracé permanent à `sketch`, remet
// `strokeLive` à vide, et notifie la scène (event dédié cascadé, jamais la
// réutilisation d'un event déjà consommé localement — voir
// docs/plans/2026-07-23-canvas-stroke-capture-plan.md).
const strokeStraps: StrapCollection = {
  "measure-area": ({ event }) => {
    const { left, top } = event.data as { left: number; top: number };
    return { update: { areaLeft: left, areaTop: top } };
  },
  "stroke-build-path": ({ event, state }) => {
    const { points, color } = event.data as StrokeCaptureState;
    if (points.length < 2) return {};

    const prefiltered = filterByMinDistance(points, MIN_POINT_DISTANCE);
    const reduced = reducePoints(prefiltered, RDP_EPSILON);
    const d = buildSmoothPath(reduced);
    const strokeId = String((state as StrokeStoryState).nextStrokeId);

    return {
      update: { nextStrokeId: (state as StrokeStoryState).nextStrokeId + 1 },
      events: [
        { name: "sketch:add-stroke", data: { addStroke: { id: strokeId, d, stroke: color } } },
        { name: "stroke:live:reset", data: { attr: { d: "" } } },
        { name: "sketch:stroke:committed", data: { id: strokeId, d, color }, cascade: true },
      ],
    };
  },
  "notify-sketch-cleared": () => ({
    events: [{ name: "sketch:cleared", cascade: true }],
  }),
};

export const SKETCH_STORAGE_KEY = "codplay-stroke-path-sketch";

async function readStoredStrokes(): Promise<StoredStroke[]> {
  try {
    const raw = localStorage.getItem(SKETCH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredStroke[]) : [];
  } catch {
    return [];
  }
}

// Scene-strap : "action side-effect" n'est pas un type à part, c'est la
// faculté normative (v1-strap-spec.md règles 2-3) d'un strap de scène
// d'être async pour un side-effect global (ici localStorage, demain un
// fetch vers une vraie base — l'interface ne change pas). Pas de cache
// intermédiaire dans scene.state : lecture/écriture directe de
// localStorage à chaque notification, une seule source de vérité.
// `save:done` n'a rien à cascader : un event de scene-strap n'a pas de
// story d'origine (scopeStoryId déjà undefined), il atteint directement
// perso.actions["save:done"] par résolution globale (player.ts::routeSceneEvent).
export const sceneStraps: StrapCollection = {
  "save-sketch": async ({ event }) => {
    if (event.name === "sketch:cleared") {
      localStorage.removeItem(SKETCH_STORAGE_KEY);
    } else {
      const stroke = event.data as StoredStroke;
      const current = await readStoredStrokes();
      localStorage.setItem(SKETCH_STORAGE_KEY, JSON.stringify([...current, stroke]));
    }
    return {
      events: [
        {
          name: "save:done",
          data: { style: { borderColor: { from: "#22c55e", to: "#cbd5e1", duration: 1000 } } },
        },
      ],
    };
  },
};

export function createStrokePathScene(): SceneDoc {
  return {
    id: "stroke-path-scene",
    initial: undefined,
    straps: ["save-sketch"],
    listen: [
      { on: "sketch:stroke:committed", straps: ["save-sketch"] },
      { on: "sketch:cleared", straps: ["save-sketch"] },
    ],
    stories: {
      [STROKE_STORY_ID]: {
        id: STROKE_STORY_ID,
        state: { areaLeft: 0, areaTop: 0, nextStrokeId: 0 },
        initial: { move: "@root" },
        straps: strokeStraps,
        listen: [
          { on: "stroke:area:measured", straps: ["measure-area"] },
          { on: "stroke:captured", straps: ["stroke-build-path"] },
          { on: "sketch:clear", straps: ["notify-sketch-cleared"] },
        ],
        persos: [
          {
            // Grille à deux lignes : la première (`1fr`) prend l'espace
            // restant, la seconde (`auto`) se dimensionne sur le bouton —
            // aucune valeur figée, la mise en page reste stable quel que
            // soit le contenu du SVG. `padding` porte l'espacement (plus de
            // `margin` sur le SVG lui-même).
            id: "sketchContainer",
            type: "layout",
            initial: {
              move: "@root",
              format: "html",
              markup:
                '<div style="display:grid;grid-template-rows:1fr auto;gap:12px;width:100%;min-height:100%;padding:4rem;"><div data-part="sketchContainer:area"></div><div data-part="sketchContainer:controls"></div></div>',
              outlets: [{ id: "sketchContainer:area" }, { id: "sketchContainer:controls" }],
            },
            actions: { sketchContainer: null },
          },
          {
            id: "strokeArea",
            type: "layout",
            initial: {
              move: { parentId: "sketchContainer:area" },
              format: "svg",
              // Pas de `viewBox` : 1 unité svg = 1px css, quelle que soit la taille
              // réelle du conteneur — les coordonnées locales (issues de `clientX`/
              // `clientY`, voir `trackStroke`) restent alignées 1:1 sans déformation.
              // Fond/bordure distincts du blanc de `.container` (demo-container.css) pour
              // que la zone de tracé se voie clairement.
              markup:
                '<svg width="100%" height="100%" style="background:#eef2f7;border:2px solid #cbd5e1;box-sizing:border-box;touch-action:none;display:block;"><g data-part="strokeArea:shape"></g></svg>',
              outlets: [{ id: "strokeArea:shape" }],
            },
            emit: {
              pointerdown: {
                // `event` requis par EmitRuleAction, mais volontairement non consommé
                // (aucune action/listen sur ce nom) : rien ne doit se produire à
                // l'ouverture du geste, seule la capture s'ouvre.
                event: { name: "stroke:start" },
                // Empêche la sélection de texte native (le panneau de logs à côté)
                // pendant le drag du tracé.
                preventDefault: true,
                capture: {
                  trackOn: ["pointermove"],
                  endOn: ["pointerup", "pointercancel"],
                  initCaptureState: initStrokeCaptureState,
                  trackCommand: trackStroke,
                  endEmit: { name: "stroke:captured" },
                },
              },
            },
            // "save:done" (émis par le scene-strap "save-sketch", sans story
            // d'origine — voir le plan) atteint directement cette action par
            // résolution globale perso.actions[eventName], sans listen/strap
            // supplémentaire côté story.
            actions: { strokeArea: null, "save:done": {} },
          },
          {
            // Scratch du tracé en cours (dessin live) — perso séparé et "bête",
            // seul point que le canal de tick d'une capture peut atteindre
            // (contourne component.update() entièrement, voir le plan).
            id: "strokeLive",
            type: "layout",
            initial: {
              move: { parentId: "strokeArea:shape" },
              format: "svg",
              markup:
                '<path d="" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
            },
            actions: { stroke_tracking: {}, "stroke:live:reset": {} },
          },
          {
            // Accumulation des tracés terminés — composant externe (@codplay/sketch),
            // voir stroke-path-demo.ts.
            id: "sketch",
            type: "sketch",
            initial: { move: { parentId: "strokeArea:shape" } },
            actions: { "sketch:add-stroke": {}, "sketch:clear": {}, "sketch:restore": {} },
          },
          {
            id: "sketchClearButton",
            type: "tag",
            initial: {
              tag: "button",
              move: { parentId: "sketchContainer:controls" },
              content: "Effacer",
              style: {
                margin: "0 24px 8px",
                padding: "6px 14px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                cursor: "pointer",
              },
            },
            emit: {
              pointerdown: {
                // `data` est un champ d'`EmitRuleAction`, frère d'`event` — pas
                // une propriété d'`EmitRuleEvent` (`{name, cascade}` seulement).
                event: { name: "sketch:clear" },
                data: { clear: true },
              },
            },
            actions: { sketchClearButton: null },
          },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc;
}
