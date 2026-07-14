export type DemoEntry = {
  id: string;
  label: string;
  href: string;
};

export const DEMO_REGISTRY: DemoEntry[] = [
  { id: "Flip", label: "Flip", href: "?demo=codplay-poc" },
  { id: "quiz", label: "Quiz compteur", href: "?demo=quiz" },
  { id: "quiz-series", label: "Quiz Série", href: "?demo=quiz-series" },
  { id: "drag", label: "Drag & Capture", href: "?demo=drag" },
  { id: "dnd-list", label: "Drag & Drop listes", href: "?demo=dnd-list" },
  { id: "preload-media", label: "Preload Media", href: "?demo=preload-media" },
  { id: "replace-carousel", label: "Replace Carousel", href: "?demo=replace-carousel" },
  { id: "avatar-poc-1", label: "Avatar 3D", href: "?demo=avatar-poc-1" },
  { id: "rive-coach", label: "Rive lip-sync", href: "?demo=rive-coach" },
  { id: "threejs-anime-grid", label: "animation 3D", href: "?demo=threejs-anime-grid" },
  { id: "mashup-rive-three-quiz", label: "Mashup Rive/3D/Quiz", href: "?demo=mashup-rive-three-quiz" },
  { id: "chrono", label: "Chronomètre", href: "?demo=chrono" },
  { id: "move-off", label: "Détachement DOM", href: "?demo=move-off" },
  { id: "overlay-world-outlet", label: "Overlay-world outlet", href: "?demo=overlay-world-outlet" },
  { id: "polygon", label: "Polygon", href: "?demo=polygon" },
  { id: "container-query-placement", label: "Placement cqw/cqh", href: "?demo=container-query-placement" },
  { id: "quiz-hunt", label: "Quiz Hunt", href: "?demo=quiz-hunt" },
  { id: "selection-frame", label: "Selection Frame", href: "?demo=selection-frame" },
  { id: "selection-frame-grid", label: "Selection Frame grid", href: "?demo=selection-frame-grid" },
  { id: "zone-editor", label: "Éditeur de zones", href: "?demo=zone-editor" },
];

/**
 * Subset of DEMO_REGISTRY exposed on the "fame" page (fame.html), a separate
 * entry point that showcases a curated selection of demos.
 */
export const FAME_REGISTRY: DemoEntry[] = [
  { id: "quiz", label: "Quiz compteur", href: "fame.html?demo=quiz" },
  { id: "quiz-series", label: "Quiz Série", href: "fame.html?demo=quiz-series" },
  { id: "Flip", label: "Flip", href: "fame.html?demo=codplay-poc" },
  { id: "chrono", label: "Chronomètre", href: "fame.html?demo=chrono" },
  { id: "polygon", label: "Polygon", href: "fame.html?demo=polygon" },
  { id: "mashup-rive-three-quiz", label: "Mashup Rive/3D/Quiz", href: "fame.html?demo=mashup-rive-three-quiz" },
];

export function buildDemoLinksMarkup(activeId: string | undefined, entries: DemoEntry[] = DEMO_REGISTRY): string {
  return entries.map(
    (entry) =>
      `<a class="demo-link${entry.id === activeId ? " demo-link-active" : ""}" href="${entry.href}">${entry.label}</a>`,
  ).join("");
}
