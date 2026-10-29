import type { ElceResolvedPlayerSettings } from '../../domain/editor-settings/editor-settings-types'

/** Styles the fixed viewport projection and contained image frame used by Elcé. */
export function createViewportExpansionStyleSheet(
  settings: ElceResolvedPlayerSettings['interactions']['viewportExpansion'],
): string {
  return `
.elce-viewport-expansion-host {
  position: fixed;
  inset: 0;
  display: grid;
  width: 100vw;
  height: 100vh;
  z-index: 19;
  box-sizing: border-box;
  overflow: hidden;
  place-items: stretch;
  background: color-mix(in srgb, var(--elce-appearance-menu-background) ${settings.backdropOpacity * 100}%, transparent);
  color: var(--elce-appearance-menu-foreground);
  pointer-events: none;
  visibility: hidden;
  transition: visibility 0s linear ${settings.durationMs}ms;
}

.elce-viewport-expansion-host--open {
  pointer-events: auto;
  visibility: visible;
  transition: visibility 0s;
}

.elce-viewport-expansion-host--closing {
  pointer-events: auto;
  visibility: hidden;
  transition: visibility 0s linear ${settings.durationMs}ms;
}

.elce-viewport-expansion-host__frame {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  overflow: hidden;
  touch-action: none;
  overscroll-behavior: contain;
}

.elce-player-stage .elce-viewport-content--expanded {
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  box-sizing: border-box;
}

.elce-player-stage [data-elce-viewport-content='image'].elce-viewport-content--expanded {
  pointer-events: none;
  user-select: none;
}

.elce-player-stage [data-elce-viewport-content='image'].elce-viewport-content--expanded > .cp-img-inner {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: 100%;
  max-height: 100%;
  aspect-ratio: auto !important;
  object-fit: contain !important;
}

.elce-player-stage [data-elce-viewport-content='graph'].elce-viewport-content--expanded {
  overflow: auto;
  aspect-ratio: auto;
  container-type: inline-size;
}

.elce-player-stage .elce-statistical-graph__visual-content {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 0;
  container-type: inline-size;
}

.elce-player-stage .elce-statistical-graph__visual-content--table {
  height: auto;
  overflow: auto;
}

.elce-player-stage .elce-viewport-content--expanded.elce-statistical-graph__visual-content--table {
  height: 100%;
}

.elce-player-stage [data-elce-viewport-content='image']:not(.elce-viewport-content--expanded),
.elce-player-stage [data-elce-viewport-content='graph']:not(.elce-viewport-content--expanded) {
  cursor: zoom-in;
}

.elce-viewport-expansion-host--open {
  cursor: zoom-out;
}

.elce-viewport-expansion__arrow {
  position: absolute;
  z-index: 1;
  display: grid;
  width: 3.25rem;
  height: 4rem;
  place-items: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--elce-appearance-border) 36%, transparent);
  border-radius: 0.5rem;
  color: var(--elce-appearance-menu-foreground);
  background: color-mix(in srgb, var(--elce-appearance-menu-background) 68%, transparent);
  font: inherit;
  font-size: 2.5rem;
  line-height: 1;
  cursor: pointer;
}

.elce-viewport-expansion__arrow--previous {
  inset-inline-start: max(1rem, env(safe-area-inset-left));
  top: 50%;
  transform: translateY(-50%);
}

.elce-viewport-expansion__arrow--next {
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  top: 50%;
  transform: translateY(-50%);
}

.elce-viewport-expansion__arrow:disabled {
  opacity: 0.35;
  cursor: default;
}

.elce-viewport-scroll-locked {
  overflow-y: hidden !important;
  overscroll-behavior: none;
  scrollbar-gutter: stable;
}

@media (max-width: 600px) {
  .elce-viewport-expansion__arrow {
    width: 2.75rem;
    height: 3.5rem;
  }
}
`
}
