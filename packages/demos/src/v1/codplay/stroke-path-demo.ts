import { createSketchBinding } from "@codplay/sketch";
import { createStrokePathScene, sceneStraps, SKETCH_STORAGE_KEY } from "../scenes/stroke-path-scene";
import type { StoredStroke } from "../scenes/stroke-path-scene";
import { runCodPlaySceneDemo } from "./run-codplay-scene-demo";
import type { DemoEntry } from "../shared/demo-registry";
import type { Player } from "codplay/player/player";

const STROKE_STORY_ID = "stroke-path-story";

// Mesure l'offset écran de `strokeArea` (hors du contrat de capture — accès
// node ordinaire, côté démo) et le pousse dans `story.state` via un event
// normal : `initCaptureState` le lit ensuite pour ancrer `trackCommand` sur
// la vraie position du pointeur (voir `stroke-path-scene.ts`).
// `source: "system"` est nécessaire : `Player.emit` rejette silencieusement
// tout event `source: "user"` (la valeur par défaut) tant que le player
// n'est pas en lecture (`PLAYER_USER_EVENTS_PAUSED`) — le player démarre en
// pause et n'est jamais auto-play ici (`play()` reste une action utilisateur,
// jamais automatisée). Cette mesure n'est pas une interaction utilisateur,
// donc `system` est la source correcte, pas seulement un contournement.
// `scopeStoryId` est nécessaire aussi : sans lui (ni `cascade: true`),
// `resolveStateTarget` (`player.ts:648-655`) route l'`update` du strap vers
// `scene.state`, pas `story.state` — alors qu'`initCaptureState` lit
// `story.state` par défaut (pas de `stateScope: 'scene'` déclaré).
async function measureStrokeArea(player: Player): Promise<void> {
  const node = globalThis.document.getElementById("strokeArea");
  if (node === null) return;
  const rect = node.getBoundingClientRect();
  await player.emit({
    name: "stroke:area:measured",
    data: { left: rect.left, top: rect.top },
    source: "system",
    scopeStoryId: STROKE_STORY_ID,
  });
}

// Lit localStorage (vide si absent/invalide) et restitue les tracés
// accumulés au démarrage. Côté démo, pas `scene.init()` : même raison que
// `measureStrokeArea` (source: "system" requis) et `scene.init`/`onStart`
// n'exposent pas de primitive d'emit directe (`PlayerSceneLifecycleOptions`
// ne porte que `schedule`).
async function restoreSketch(player: Player): Promise<void> {
  let strokes: StoredStroke[] = [];
  try {
    const raw = localStorage.getItem(SKETCH_STORAGE_KEY);
    strokes = raw ? (JSON.parse(raw) as StoredStroke[]) : [];
  } catch {
    strokes = [];
  }
  // `StoredStroke.color` (nom générique côté persistance) -> `stroke` (nom
  // attendu par SketchingComponent, utilisé tel quel pour l'attribut SVG
  // `stroke`) — sans cette traduction, `stroke.stroke` est `undefined` au
  // restore, donc aucune couleur de trait valide.
  await player.emit({
    name: "sketch:restore",
    data: { restore: strokes.map((s) => ({ id: s.id, d: s.d, stroke: s.color })) },
    source: "system",
    scopeStoryId: STROKE_STORY_ID,
  });
}

export async function runStrokePathDemo(demoLinks?: DemoEntry[]): Promise<void> {
  await runCodPlaySceneDemo({
    title: "Stroke Path",
    subtitle: "Tracez avec le pointeur — le tracé SVG suit le geste en direct, puis se fige à la couleur du trait.",
    scene: createStrokePathScene(),
    activeDemo: "stroke-path",
    demoLinks,
    strapCollection: sceneStraps,
    async setup() {
      const binding = createSketchBinding();
      return { components: binding.components };
    },
    onReady: ({ player }) => {
      void measureStrokeArea(player);
      void restoreSketch(player);
      globalThis.window.addEventListener("resize", () => void measureStrokeArea(player));
    },
  });
}
