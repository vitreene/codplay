export type DemoEntry = {
  id: string
  label: string
  href: string
}

export const DEMO_REGISTRY: DemoEntry[] = [
  { id: 'poc',         label: 'Player POC',        href: '?demo=poc' },
  { id: 'codplay-poc', label: 'CodPlay POC',        href: '?demo=codplay-poc' },
  { id: 'quiz',        label: 'Quiz Reference',     href: '?demo=quiz' },
  { id: 'drag',        label: 'Drag & Capture',     href: '?demo=drag' },
  { id: 'dnd-list',   label: 'Drag & Drop listes', href: '?demo=dnd-list' },
]

export function buildDemoLinksMarkup(activeId: string | undefined): string {
  return DEMO_REGISTRY
    .map((entry) =>
      `<a class="demo-link${entry.id === activeId ? ' demo-link-active' : ''}" href="${entry.href}">${entry.label}</a>`
    )
    .join('')
}
