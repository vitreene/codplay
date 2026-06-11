export type DemoEntry = {
  id: string
  label: string
  href: string
}

export const DEMO_REGISTRY: DemoEntry[] = [
  { id: 'poc',         label: 'Player POC',        href: '?demo=poc' },
  { id: 'codplay-poc', label: 'CodPlay POC',        href: '?demo=codplay-poc' },
  { id: 'quiz',        label: 'Quiz Reference',     href: '?demo=quiz' },
  { id: 'quiz-question', label: 'Quiz Question',    href: '?demo=quiz-question' },
  { id: 'quiz-series',   label: 'Quiz Série',       href: '?demo=quiz-series' },
  { id: 'drag',        label: 'Drag & Capture',     href: '?demo=drag' },
  { id: 'dnd-list',   label: 'Drag & Drop listes', href: '?demo=dnd-list' },
  { id: 'preload-media', label: 'Preload Media',  href: '?demo=preload-media' },
  { id: 'carousel',         label: 'Carrousel',          href: '?demo=carousel' },
  { id: 'replace-carousel', label: 'Replace Carousel',   href: '?demo=replace-carousel' },
]

export function buildDemoLinksMarkup(activeId: string | undefined): string {
  return DEMO_REGISTRY
    .map((entry) =>
      `<a class="demo-link${entry.id === activeId ? ' demo-link-active' : ''}" href="${entry.href}">${entry.label}</a>`
    )
    .join('')
}
