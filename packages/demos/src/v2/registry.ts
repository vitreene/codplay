import type { V2DemoModule } from "./layout/types";

/** Keeps Vite development CSS imports fetchable by the external preload strategy. */
function resolveStylesheetUrl(url: string): string {
  if (!import.meta.env.DEV) return url;
  return `${url}${url.includes("?") ? "&" : "?"}direct`;
}

/** Static metadata used by the common layout before a demo scene is loaded. */
export type V2DemoDefinition = Readonly<{
  id: string;
  path: string;
  title: string;
  description: string;
  load: () => Promise<V2DemoModule>;
}>;

/** V2 demos are loaded on demand so the selector does not import every scene. */
export const V2_DEMO_REGISTRY: readonly V2DemoDefinition[] = [
  {
    id: "flip-list",
    path: "?demo=flip-list",
    title: "FLIP stress test",
    description:
      "Deux listes échangent leurs éléments un par un pendant que leurs conteneurs se déplacent et que la fenêtre peut être redimensionnée.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/flip-stress/main"),
        import("./demos/flip-stress/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "components",
    path: "?demo=components",
    title: "basic components",
    description:
      "Une scène présente une image, un polygone SVG et une question interactive sur la même timeline.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/components/components-scene"),
        import("./demos/components/style.css?url"),
      ]);
      return {
        createScene: module.createComponentsScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "polygon",
    path: "?demo=polygon",
    title: "Polygone interactif",
    description: "Le polygone V2 reprend la scène V1 : paramètres, remises à zéro et morphing SVG.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/polygon/main"),
        import("./demos/polygon/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "stroke-path",
    path: "?demo=stroke-path",
    title: "Stroke Path — capture live",
    description: "Capture V2 en continu et accumulation de tracés SVG (fixture expérimentale non normative).",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/stroke-path/main"),
        import("./demos/stroke-path/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        initialEvents: module.createInitialEvents(),
        engineCapabilities: module.engineCapabilities,
      };
    },
  },
  {
    id: "preload-media",
    path: "?demo=preload-media",
    title: "Preload média",
    description: "Audio, vidéo et images sont chargés avant le démarrage de la scène.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/preload-media/main"),
        import("./demos/preload-media/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },

  {
    id: "flip-nested",
    path: "?demo=flip-nested",
    title: "flip imbriqué",
    description:
      "Un parent et son enfant changent de conteneur ensemble, tandis que les éléments voisins restent dans leur liste.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/runner/main"),
        import("./demos/runner/style.css?url"),
      ]);
      return {
        createScene: module.createNestedFlipScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "quiz-series",
    path: "?demo=quiz-series",
    title: "Quiz — Série de 3 questions",
    description: "Vrai/Faux, réponse unique, réponses multiples. Résultat final : 2/3 pour réussir.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/quiz-series/main"),
        import("./demos/quiz-series/style.css?url"),
      ]);
      const { quizSeriesAutoPlayback } = await import("./demos/quiz-series/auto-playback");
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        playback: quizSeriesAutoPlayback,
      };
    },
  },
  {
    id: "chrono",
    path: "?demo=chrono",
    title: "Chronomètre",
    description: "Un chronomètre piloté par des événements discrets et deux TweenAction seek-compatibles.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/chrono/main"),
        import("./demos/chrono/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "position",
    path: "?demo=position",
    title: "Positions",
    description: "Source, cible, reparenting, paths capturés et trajectoires live",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/position/main"),
        import("./demos/position/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        initialEvents: module.POSITION_INITIAL_EVENTS,
      };
    },
  },
  {
    id: "events",
    path: "?demo=events",
    title: "Events — comment ça fonctionne",
    description: "Émission, distribution, écoute et délai autour d’une barrière d’accès.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/events/main"),
        import("./demos/events/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        initialEvents: module.EVENTS_INITIAL_EVENTS,
      };
    },
  },
  {
    id: "threejs-grid",
    path: "?demo=threejs-grid",
    title: "Three.js — grille procédurale",
    description: "Scène, caméra, lumières et géométrie sont des persos reliés par rel, puis rendus en une seule projection.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/threejs-grid/main"),
        import("./demos/threejs-grid/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
      };
    },
  },
  {
    id: "rive",
    path: "?demo=rive",
    title: "Rive lip-sync",
    description: "Le document Rive V1 est porté par un host et une state machine V2 distincte.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/rive/main"),
        import("./demos/rive/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        engineCapabilities: module.engineCapabilities,
        preloadStrategies: module.preloadStrategies,
      };
    },
  },
  {
    id: "avatar",
    path: "?demo=avatar",
    title: "Avatar — composants spécialisés",
    description: "Un avatar Three.js reçoit séparément les contributions de mood, lip-sync, geste et regard.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/avatar/main"),
        import("./demos/avatar/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        engineCapabilities: module.engineCapabilities,
        preloadManifest: module.preloadManifest,
        preloadStrategies: module.preloadStrategies,
      };
    },
  },
  {
    id: "scroll-container",
    path: "?demo=scroll-container",
    title: "Scroll-container — texte, image et visibilité",
    description: "En faisant défiler le récit, l’image glisse dans la page puis se rétracte au retour ; le journal montre les événements enter/leave.",
    load: async () => {
      const [module, stylesheet] = await Promise.all([
        import("./demos/scroll-container/main"),
        import("./demos/scroll-container/style.css?url"),
      ]);
      return {
        createScene: module.createScene,
        stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
        engineCapabilities: module.engineCapabilities,
        sourceAdapterFactories: module.sourceAdapterFactories,
      };
    },
  },
];

/** Ordered V2 demo IDs shown by the curated Fame page. */
const V2_FAME_DEMO_IDS = [
  "components",
  "events",
  "position",
  "quiz-series",
  "polygon",
  "preload-media",
  "chrono",
  "threejs-grid",
  "rive",
  "stroke-path",
] as const;

/** Resolves an ordered list of IDs through the single V2 demo registry. */
function selectV2Demos(ids: readonly string[]): readonly V2DemoDefinition[] {
  return ids.map((id) => {
    const demo = V2_DEMO_REGISTRY.find((candidate) => candidate.id === id);
    if (demo === undefined) throw new Error(`V2 demo registry is missing ${id}.`);
    return demo;
  });
}

/** Curated selection shown by the V2 Fame page. */
export const V2_FAME_DEMO_REGISTRY = selectV2Demos(V2_FAME_DEMO_IDS);

/** Resolves a selected demo and falls back to the first entry in its list. */
export function resolveV2Demo(
  id: string | null,
  demos: readonly V2DemoDefinition[] = V2_DEMO_REGISTRY,
): V2DemoDefinition {
  return demos.find((demo) => demo.id === id) ?? demos[0]!;
}
