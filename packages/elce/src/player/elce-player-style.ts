/** Scoped CSS for the complete Elcé document projection. */
export const ELCE_PLAYER_STYLE_SHEET = `
.elce-player-layout {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 100%;
  grid-template-columns: minmax(12rem, 17rem) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: 'menu title' 'menu content' 'menu navigation';
  overflow: hidden;
  color: var(--elce-appearance-text);
}

.elce-player-menu-drawer {
  display: contents;
}

.elce-player-menu-toggle,
.elce-player-menu-close {
  display: none;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.45rem;
  color: var(--elce-appearance-menu-foreground);
  background: var(--elce-appearance-menu-background);
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.elce-player-menu-toggle svg,
.elce-player-menu-close svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 2;
}

.elce-player-layout__menu,
.elce-player-layout__title,
.elce-player-layout__content,
.elce-player-layout__navigation,
.elce-player-layout__menu-slot,
.elce-player-layout__title-slot,
.elce-player-layout__content-slot,
.elce-player-layout__navigation-slot {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
}

.elce-player-layout__menu {
  grid-area: menu;
  overflow: hidden;
  color: var(--elce-appearance-menu-foreground);
  background: var(--elce-appearance-menu-background);
}

.elce-player-layout__title {
  display: flex;
  min-height: 4.25rem;
  grid-area: title;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid var(--elce-appearance-border);
  background: var(--elce-appearance-surface);
}

.elce-player-layout__content {
  grid-area: content;
  min-height: 0;
  padding: 1rem;
  overflow: hidden;
}

.elce-player-layout__navigation {
  min-height: 4rem;
  grid-area: navigation;
  border-top: 1px solid var(--elce-appearance-border);
  color: var(--elce-appearance-navigation-foreground);
  background: var(--elce-appearance-navigation-background);
}

.elce-player-layout__menu-slot,
.elce-player-layout__title-slot,
.elce-player-layout__content-slot,
.elce-player-layout__navigation-slot {
  width: 100%;
  height: 100%;
}

.elce-player-layout__title-slot {
  min-width: 0;
  flex: 1;
  container-type: inline-size;
}

.elce-player-title {
  margin: 0;
  color: var(--elce-appearance-title);
  font-size: clamp(1.41rem, 3.8916cqi, 2.4675rem);
  line-height: 1.2;
}

.elce-player-layout__content :is(h1, h2, h3, h4, h5, h6) {
  color: var(--elce-appearance-intertitle);
}

.elce-player-layout__content :is(h1) {
  color: var(--elce-appearance-title);
}

.elce-player-menu {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0.8rem;
  box-sizing: border-box;
}

.elce-player-menu__title {
  margin: 0;
  padding: 0.2rem 0.45rem 0.6rem;
  border-bottom: 1px solid color-mix(in srgb, var(--elce-appearance-menu-foreground) 20%, transparent);
  font-size: 1.128rem;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.elce-player-menu__description {
  margin: 0 0.45rem;
  color: color-mix(in srgb, var(--elce-appearance-menu-foreground) 82%, transparent);
  font-size: 0.9rem;
  line-height: 1.45;
}

.elce-player-menu__scroll {
  min-height: 0;
  overflow: auto;
  padding: 0.2rem 0.2rem 1rem;
}

.elce-player-menu__entries {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.elce-player-menu__group {
  margin-top: 0.8rem;
}

.elce-player-menu__group-title {
  margin: 0;
  padding: 0.2rem 0.45rem;
  color: var(--elce-appearance-menu-foreground);
  font-size: 1.1562rem;
  line-height: 1.2;
}

.elce-player-menu__pages {
  display: grid;
  gap: 0.12rem;
  margin: 0.15rem 0 0;
  padding: 0 0 0 0.75rem;
  list-style: none;
}

.elce-player-menu__pages--root {
  padding-left: 0;
}

.elce-player-menu__page-row {
  margin: 0;
  padding: 0;
}

.elce-player-menu__chapter-button,
.elce-player-menu__page-button {
  width: 100%;
  border: 0;
  color: var(--elce-appearance-menu-foreground);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.elce-player-menu__chapter-button {
  padding: 0.48rem 0.5rem;
  border-radius: 0.35rem;
}

.elce-player-menu__page-button {
  padding: 0.42rem 0.5rem;
  border-left: 2px solid transparent;
  border-radius: 0.25rem;
  font-size: 0.76rem;
  line-height: 1.35;
}

.elce-player-menu__page-button[data-active='true'] {
  border-left-color: var(--elce-appearance-accent-secondary);
  color: var(--elce-appearance-menu-foreground);
  background: color-mix(in srgb, var(--elce-appearance-menu-foreground) 12%, transparent);
}

.elce-player-menu__page-button[data-locked='true'] {
  color: var(--elce-appearance-muted);
  font-style: italic;
}

.elce-player-menu__chapter-button[data-locked='true'],
.elce-player-menu__page-button[data-locked='true'],
.elce-summary__entry-button[data-locked='true'] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.elce-player-menu__chapter-button[data-locked='true']::after,
.elce-player-menu__page-button[data-locked='true']::after,
.elce-summary__entry-button[data-locked='true']::after {
  content: '🔒';
  margin-inline-start: auto;
  font-size: 0.9em;
  font-style: normal;
}

.elce-player-menu__navigation,
.elce-player-navigation {
  width: 100%;
  height: 100%;
}

.elce-player-navigation {
  display: grid;
  min-height: 4rem;
  grid-template-columns: auto minmax(4rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem clamp(0.75rem, 2vw, 1.5rem);
}

.elce-player-navigation__button {
  min-width: 6.5rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.45rem;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  font-weight: 700;
  cursor: pointer;
}

.elce-player-navigation__button--next {
  border-color: var(--elce-appearance-accent);
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
}

.elce-player-navigation__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.elce-player-navigation__status {
  margin: 0;
  color: var(--elce-appearance-muted);
  font-size: 0.78rem;
  text-align: center;
}

.elce-player-empty-page {
  margin: auto;
  padding: 2rem;
  color: var(--elce-appearance-muted);
}

.elce-flux-scrollport {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}

.elce-flux-article {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  box-sizing: border-box;
}

.elce-flux-article > section {
  width: 100%;
  flex: 0 0 auto;
  position: relative;
}

.elce-diapo-host,
.elce-diapo-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.elce-diapo-content {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}

.elce-diapo-content > .elce-card--carousel,
.elce-diapo-carousel-root {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  position: relative;
  overflow: hidden;
  container-type: inline-size;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.elce-diapo-carousel-root > .elce-carousel__navigation {
  grid-row: 2;
  grid-column: 1;
}

.elce-diapo-content > .elce-card:not(.elce-card--carousel) {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.elce-diapo-content > .elce-card--question {
  display: flex;
  flex-direction: column;
}

.elce-diapo-content > .elce-card--question > .elce-question-illustration {
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  margin: 0;
  overflow: hidden;
}

.elce-diapo-content > .elce-card--question > form {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.elce-diapo-content > .elce-card--question > form > fieldset {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.elce-diapo-content > .elce-card--question .elce-question-answers {
  min-height: 0;
  flex: 1;
  align-content: start;
  overflow: hidden;
}

.elce-diapo-content .elce-carousel-capsule--scene,
.elce-diapo-content .elce-carousel-capsule__grid {
  height: 100%;
  min-height: 0;
}

.elce-card--carousel {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.65rem;
}

.page-flux .question:not(.has-background),
.page-flux .carousel {
  padding: clamp(1rem, 3vw, 1.6rem);
}

.elce-page-bottom-marker {
  display: block;
  width: 1px;
  height: 1px;
  margin-block-start: auto;
  opacity: 0;
}

.elce-carousel-completion-marker {
  position: absolute;
  inset-inline-end: 0;
  inset-block-end: 0;
  margin: 0;
  pointer-events: none;
}

.elce-carousel-capsule {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
}

.elce-carousel-capsule__grid {
  position: relative;
}

.elce-carousel-view {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.elce-carousel-view--visible {
  opacity: 1;
  pointer-events: auto;
}

.elce-carousel-view--hidden {
  opacity: 0;
  pointer-events: none;
}

.elce-carousel-view--hidden .elce-carousel-completion-marker {
  display: none;
}

.elce-card--text-short {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  text-align: center;
}

.elce-card--text-short > p,
.elce-card--text-short > footer {
  margin: 0;
}

/* Flex-item margins do not collapse, so the heading supplies this one gap. */
.elce-card--text-short > .elce-card__overline:has(+ .elce-card__title),
.elce-card--text-image > .elce-carousel-text-image__content > .elce-card__overline:has(+ .elce-card__title) {
  margin-block-end: 0;
}

.elce-card__meta {
  font-size: clamp(0.7rem, 1.5cqw, 0.95rem);
}

.elce-card--text-short .elce-card__title {
  font-size: max(1.7625rem, 4.935cqi);
  line-height: 1.2;
}

.elce-card__copy {
  font-size: max(0.9rem, 2.76cqi);
}

.elce-card--text-short .elce-card__message {
  line-height: 1.4;
}

.elce-card--text-image {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  grid-template-areas: 'image content';
  overflow: hidden;
}

.elce-carousel-view--image-right.elce-card--text-image {
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  grid-template-areas: 'content image';
}

.elce-card--text-image > .elce-carousel-text-image__image {
  min-width: 0;
  min-height: 0;
  grid-area: image;
  overflow: hidden;
}

.elce-card--text-image > .elce-carousel-text-image__content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  grid-area: content;
  overflow: hidden;
}

.elce-card--text-image > .elce-carousel-text-image__content > p,
.elce-card--text-image > .elce-carousel-text-image__content > footer {
  margin: 0;
}

.elce-card--text-image .elce-card__title {
  font-size: max(1.551rem, 4.23cqi);
  line-height: 1.2;
}

.elce-card--text-image .elce-card__message {
  line-height: 1.35;
}

.elce-card--photo,
.elce-card--image-caption {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.elce-card--photo > .elce-carousel-photo__media,
.elce-carousel-view.elce-card--photo.elce-carousel-photo__media {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.elce-carousel-media {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.elce-carousel-media > img,
.elce-carousel-media > video {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.elce-carousel-media--contain > img {
  object-fit: contain;
}

.elce-card--image-caption {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.elce-card--image-caption > .elce-card-image-caption__image {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.elce-card--image-caption > .elce-card__caption {
  margin: 0;
  font-size: 0.82rem;
}

.elce-carousel__navigation {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.35rem;
}

.elce-carousel-dot {
  display: inline-grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 50%;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  line-height: 1;
}

.elce-carousel-dot--active {
  border-color: var(--elce-appearance-accent);
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
}

.elce-carousel-dot:not(:disabled) {
  cursor: pointer;
}

.elce-carousel-dot:disabled {
  opacity: 0.75;
}

.elce-flux-image {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
  object-fit: contain;
}

.elce-flux-image > img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: contain;
}

.elce-flux-image .elce-flux-image__native {
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: contain;
}

.elce-flux-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.elce-flux-video:not(.elce-flux-video--anchored) {
  position: relative;
  max-width: 48rem;
  margin-inline: auto;
}

.elce-carousel-photo__media > .elce-carousel-media-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.elce-diapo-question-media {
  display: block;
  width: 100%;
  max-height: 28vh;
  object-fit: contain;
}

.elce-diapo-question-media__native {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.elce-flux-card-root {
  width: 100%;
}

.elce-card--question {
  width: 100%;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.65rem;
}

.elce-card--question header h2 {
  font-size: max(1.551rem, 3.243cqi);
}

.elce-card--question .elce-question-illustration {
  width: min(100%, 32rem);
  margin: 0 auto 1rem;
}

.elce-card--question form,
.elce-card--question fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.elce-card--question legend {
  width: 100%;
  margin: 0 0 0.8rem;
  font-size: max(1.05rem, 2.76cqi);
  font-weight: 700;
  line-height: 1.4;
}

.elce-question-instructions {
  margin: 0 0 0.5rem;
  font-size: max(0.9rem, 2.76cqi);
}

.elce-card--question .elce-question-answers {
  display: grid;
  gap: 0.55rem;
}

.elce-card--question .input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.5rem;
  background: var(--elce-appearance-surface);
}

.elce-question-validate {
  margin-top: 0.8rem;
  padding: 0.58rem 0.9rem;
  border: 0;
  border-radius: 0.45rem;
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
  font-weight: 700;
  cursor: pointer;
}

.elce-question-validate:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.elce-question-feedback {
  min-height: 1.5rem;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.elce-question-feedback--correct {
  color: var(--elce-appearance-accent);
  font-weight: 700;
}

.elce-question-feedback--incorrect {
  color: var(--elce-appearance-accent-secondary);
  font-weight: 700;
}

.elce-flux-article > section p,
.elce-flux-article > section h1,
.elce-flux-article > section h2,
.elce-flux-article > section h3,
.elce-flux-article > section h4,
.elce-flux-article > section h5,
.elce-flux-article > section h6 {
  position: relative;
}

.elce-flow-slot {
  display: inline-block;
  width: 0;
  height: 0;
  margin: 0;
  position: static;
  padding-inline: 0;
  padding-block-start: 0;
  vertical-align: baseline;
  box-sizing: border-box;
}

@media (max-width: 800px) {
  .elce-player-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: 'title' 'content' 'navigation';
  }

  .elce-player-menu-toggle {
    display: inline-grid;
    flex: 0 0 auto;
  }

  .elce-player-layout__menu {
    display: contents;
  }

  .elce-player-layout__menu-slot {
    display: contents;
  }

  .elce-player-menu-drawer {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: block;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    opacity: 0;
    pointer-events: none;
  }

  .elce-player-menu-drawer[data-open='true'] {
    pointer-events: auto;
  }

  .elce-player-menu-backdrop-host,
  .elce-player-menu-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .elce-player-menu-backdrop {
    display: block;
    padding: 0;
    border: 0;
    background: color-mix(in srgb, var(--elce-appearance-menu-background) 70%, transparent);
    cursor: pointer;
  }

  .elce-player-menu-panel {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    display: flex;
    width: min(20rem, 88vw);
    max-height: 100%;
    flex-direction: column;
    overflow: hidden;
    background: var(--elce-appearance-menu-background);
    box-shadow: 0.75rem 0 2rem color-mix(in srgb, var(--elce-appearance-menu-background) 25%, transparent);
  }

  .elce-player-layout__menu-slot {
    height: auto;
    min-height: 0;
    flex: 1;
  }

  .elce-player-menu-close {
    position: absolute;
    z-index: 1;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.65rem;
    display: inline-grid;
  }

  .elce-player-menu__title {
    padding-inline-end: 3rem;
  }

  .elce-player-menu-panel .elce-player-menu__scroll,
  .elce-player-menu-panel .elce-player-menu {
    flex: 1;
    min-height: 0;
  }

  .elce-player-menu-panel .elce-player-menu {
    height: auto;
  }
}

@media (min-width: 801px) {
  .elce-player-menu-drawer {
    display: contents;
    opacity: 1 !important;
    pointer-events: auto;
  }

  .elce-player-menu-backdrop-host,
  .elce-player-menu-backdrop,
  .elce-player-menu-close {
    display: none;
  }

  .elce-player-menu-panel {
    position: static;
    width: 100%;
    height: 100%;
    transform: none !important;
    translate: none !important;
    box-shadow: none;
    background: transparent;
  }

  .elce-player-menu-panel .elce-player-menu {
    height: 100%;
  }
}

.elce-summary--root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--elce-appearance-text);
  background: transparent;
}

.elce-player-layout.project-layout.has-background .elce-summary--root {
  background: var(--elce-appearance-background);
}

.elce-summary__background-host,
.elce-summary__background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.elce-summary__background-image {
  object-fit: cover;
}

.elce-summary__content {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
  overflow: auto;
  padding: clamp(1.25rem, 4vw, 3rem);
  background: color-mix(in srgb, var(--elce-appearance-surface) 88%, transparent);
}

.elce-summary__title {
  margin: 0;
  color: var(--elce-appearance-title);
  font-size: clamp(2.115rem, 4.23vw, 3.525rem);
  line-height: 1.2;
}

.elce-summary__description {
  max-width: 70ch;
  margin: 0;
  line-height: 1.55;
}

.elce-summary__entries {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  align-content: start;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.elce-summary__chapter {
  min-width: 0;
}

.elce-summary__chapter-title {
  margin: 0 0 0.45rem;
  color: var(--elce-appearance-intertitle);
  font-size: 1.41rem;
  line-height: 1.2;
}

.elce-summary__chapter-pages {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.elce-summary__entry-button {
  width: 100%;
  min-height: 3rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.45rem;
  padding: 0.7rem 0.85rem;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  text-align: left;
  cursor: pointer;
}

.elce-summary__entry-button[data-active='true'] {
  border-color: var(--elce-appearance-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--elce-appearance-accent) 18%, transparent);
}

.elce-summary__entry-button[data-locked='true'] {
  color: var(--elce-appearance-muted);
  background: var(--elce-appearance-surface);
}

.elce-summary__entry-button:disabled {
  cursor: not-allowed;
}

.elce-summary--menu {
  width: 100%;
}

.elce-summary--menu .elce-summary__content {
  width: 100%;
  height: auto;
  gap: 0.5rem;
  overflow: visible;
  padding: 0;
  color: var(--elce-appearance-menu-foreground);
  background: transparent;
}

.elce-summary--menu .elce-summary__title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.elce-summary--menu .elce-summary__chapter-title {
  color: var(--elce-appearance-menu-foreground);
}

.elce-summary--menu .elce-player-menu__entries {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.elce-summary--menu .elce-player-menu__pages {
  display: grid;
  gap: 0.12rem;
  margin: 0.15rem 0 0;
  padding: 0 0 0 0.75rem;
  list-style: none;
}

.elce-player-menu__summary-slot {
  width: 100%;
  min-height: 0;
}

.elce-profile-form {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
  gap: 1rem;
  box-sizing: border-box;
  overflow: auto;
  padding: clamp(1rem, 4vw, 2rem);
  background: var(--elce-appearance-surface);
}

.elce-profile-form__page > h1 {
  margin: 0;
  font-size: 2.82em;
  line-height: 1.2;
}

.elce-profile-form__fields {
  display: grid;
  max-width: 48rem;
  gap: 1rem;
}

.elce-profile-form__field {
  display: grid;
  gap: 0.6rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.5rem;
  padding: 0.85rem;
}

.elce-profile-form__choice {
  padding: 0.2rem 0;
}

.elce-profile-form__submit {
  min-height: 2.75rem;
  justify-self: start;
  border: 1px solid var(--elce-appearance-accent);
  border-radius: 0.45rem;
  padding: 0.55rem 1rem;
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
  cursor: pointer;
}

.elce-profile-form [role='status']:not(:empty) {
  color: var(--elce-appearance-accent-secondary);
}

.elce-player-profile-complete {
  margin: auto;
  padding: 2rem;
  color: var(--elce-appearance-muted);
}
`
