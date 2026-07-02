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
  { id: "quiz-hunt", label: "Quiz Hunt", href: "?demo=quiz-hunt" },
  { id: "selection-frame", label: "Selection Frame", href: "?demo=selection-frame" },
  { id: "selection-frame-grid", label: "Selection Frame grid", href: "?demo=selection-frame-grid" },
];

export function buildDemoLinksMarkup(activeId: string | undefined): string {
  return DEMO_REGISTRY.map(
    (entry) =>
      `<a class="demo-link${entry.id === activeId ? " demo-link-active" : ""}" href="${entry.href}">${entry.label}</a>`,
  ).join("");
}
