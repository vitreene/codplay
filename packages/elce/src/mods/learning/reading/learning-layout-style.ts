/** Player style rules owned by this reading resource. */
export const LEARNING_LAYOUT_STYLE_RULES = [
  [1, `
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
}`],
  [2, `

.elce-player-menu-drawer {
  display: contents;
}`],
  [3, `

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
}`],
  [4, `

.elce-player-menu-toggle svg,
.elce-player-menu-close svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 2;
}`],
  [5, `

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
}`],
  [6, `

.elce-player-layout__menu {
  grid-area: menu;
  overflow: hidden;
  color: var(--elce-appearance-menu-foreground);
  background: var(--elce-appearance-menu-background);
}`],
  [7, `

.elce-player-layout__title {
  display: flex;
  min-height: 4.25rem;
  grid-area: title;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid var(--elce-appearance-border);
  background: var(--elce-appearance-surface);
}`],
  [8, `

.elce-player-layout__content {
  grid-area: content;
  min-height: 0;
  padding: 1rem;
  overflow: hidden;
}`],
  [9, `

.elce-player-layout__navigation {
  min-height: 4rem;
  grid-area: navigation;
  border-top: 1px solid var(--elce-appearance-border);
  color: var(--elce-appearance-navigation-foreground);
  background: var(--elce-appearance-navigation-background);
}`],
  [10, `

.elce-player-layout__menu-slot,
.elce-player-layout__title-slot,
.elce-player-layout__content-slot,
.elce-player-layout__navigation-slot {
  width: 100%;
  height: 100%;
}`],
  [11, `

.elce-player-layout__title-slot {
  min-width: 0;
  flex: 1;
  container-type: inline-size;
}`],
  [12, `

.elce-player-title {
  margin: 0;
  color: var(--elce-appearance-title);
  font-size: clamp(1.41rem, 3.8916cqi, 2.4675rem);
  line-height: 1.2;
}`],
  [13, `

.elce-player-layout__content :is(h1, h2, h3, h4, h5, h6) {
  color: var(--elce-appearance-intertitle);
}`],
  [14, `

.elce-player-layout__content :is(h1) {
  color: var(--elce-appearance-title);
}`],
  [15, `

.elce-player-menu {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0.8rem;
  box-sizing: border-box;
}`],
  [16, `

.elce-player-menu__title {
  margin: 0;
  padding: 0.2rem 0.45rem 0.6rem;
  border-bottom: 1px solid color-mix(in srgb, var(--elce-appearance-menu-foreground) 20%, transparent);
  font-size: 1.128rem;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}`],
  [17, `

.elce-player-menu__description {
  margin: 0 0.45rem;
  color: color-mix(in srgb, var(--elce-appearance-menu-foreground) 82%, transparent);
  font-size: 0.9rem;
  line-height: 1.45;
}`],
  [18, `

.elce-player-menu__scroll {
  min-height: 0;
  overflow: auto;
  padding: 0.2rem 0.2rem 1rem;
}`],
  [19, `

.elce-player-menu__entries {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}`],
  [20, `

.elce-player-menu__group {
  margin-top: 0.8rem;
}`],
  [21, `

.elce-player-menu__group-title {
  margin: 0;
  padding: 0.2rem 0.45rem;
  color: var(--elce-appearance-menu-foreground);
  font-size: 1.1562rem;
  line-height: 1.2;
}`],
  [22, `

.elce-player-menu__pages {
  display: grid;
  gap: 0.12rem;
  margin: 0.15rem 0 0;
  padding: 0 0 0 0.75rem;
  list-style: none;
}`],
  [23, `

.elce-player-menu__pages--root {
  padding-left: 0;
}`],
  [24, `

.elce-player-menu__page-row {
  margin: 0;
  padding: 0;
}`],
  [25, `

.elce-player-menu__chapter-button,
.elce-player-menu__page-button {
  width: 100%;
  border: 0;
  color: var(--elce-appearance-menu-foreground);
  background: transparent;
  text-align: left;
  cursor: pointer;
}`],
  [26, `

.elce-player-menu__chapter-button {
  padding: 0.48rem 0.5rem;
  border-radius: 0.35rem;
}`],
  [27, `

.elce-player-menu__page-button {
  padding: 0.42rem 0.5rem;
  border-left: 2px solid transparent;
  border-radius: 0.25rem;
  font-size: 0.76rem;
  line-height: 1.35;
}`],
  [28, `

.elce-player-menu__page-button[data-active='true'] {
  border-left-color: var(--elce-appearance-accent-secondary);
  color: var(--elce-appearance-menu-foreground);
  background: color-mix(in srgb, var(--elce-appearance-menu-foreground) 12%, transparent);
}`],
  [29, `

.elce-player-menu__page-button[data-locked='true'] {
  color: var(--elce-appearance-muted);
  font-style: italic;
}`],
  [30, `

.elce-player-menu__chapter-button[data-locked='true'],
.elce-player-menu__page-button[data-locked='true'],
.elce-summary__entry-button[data-locked='true'] {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}`],
  [31, `

.elce-player-menu__chapter-button[data-locked='true']::after,
.elce-player-menu__page-button[data-locked='true']::after,
.elce-summary__entry-button[data-locked='true']::after {
  content: '🔒';
  margin-inline-start: auto;
  font-size: 0.9em;
  font-style: normal;
}`],
  [32, `

.elce-player-menu__navigation,
.elce-player-navigation {
  width: 100%;
  height: 100%;
}`],
  [33, `

.elce-player-navigation {
  display: grid;
  min-height: 4rem;
  grid-template-columns: auto minmax(4rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem clamp(0.75rem, 2vw, 1.5rem);
}`],
  [34, `

.elce-player-navigation__button {
  min-width: 6.5rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.45rem;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  font-weight: 700;
  cursor: pointer;
}`],
  [35, `

.elce-player-navigation__button--next {
  border-color: var(--elce-appearance-accent);
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
}`],
  [36, `

.elce-player-navigation__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}`],
  [37, `

.elce-player-navigation__status {
  margin: 0;
  color: var(--elce-appearance-muted);
  font-size: 0.78rem;
  text-align: center;
}`],
  [38, `

.elce-player-empty-page {
  margin: auto;
  padding: 2rem;
  color: var(--elce-appearance-muted);
}`],
  [122, `

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
}`],
  [123, `

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
}`],
  [124, `

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
}`],
  [125, `

.elce-summary--root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--elce-appearance-text);
  background: transparent;
}`],
  [126, `

.elce-player-layout.project-layout.has-background .elce-summary--root {
  background: var(--elce-appearance-background);
}`],
  [127, `

.elce-summary__background-host,
.elce-summary__background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}`],
  [128, `

.elce-summary__background-image {
  object-fit: cover;
}`],
  [129, `

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
}`],
  [130, `

.elce-summary__title {
  margin: 0;
  color: var(--elce-appearance-title);
  font-size: clamp(2.115rem, 4.23vw, 3.525rem);
  line-height: 1.2;
}`],
  [131, `

.elce-summary__description {
  max-width: 70ch;
  margin: 0;
  line-height: 1.55;
}`],
  [132, `

.elce-summary__entries {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  align-content: start;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}`],
  [133, `

.elce-summary__chapter {
  min-width: 0;
}`],
  [134, `

.elce-summary__chapter-title {
  margin: 0 0 0.45rem;
  color: var(--elce-appearance-intertitle);
  font-size: 1.41rem;
  line-height: 1.2;
}`],
  [135, `

.elce-summary__chapter-pages {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}`],
  [136, `

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
}`],
  [137, `

.elce-summary__entry-button[data-active='true'] {
  border-color: var(--elce-appearance-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--elce-appearance-accent) 18%, transparent);
}`],
  [138, `

.elce-summary__entry-button[data-locked='true'] {
  color: var(--elce-appearance-muted);
  background: var(--elce-appearance-surface);
}`],
  [139, `

.elce-summary__entry-button:disabled {
  cursor: not-allowed;
}`],
  [140, `

.elce-summary--menu {
  width: 100%;
}`],
  [141, `

.elce-summary--menu .elce-summary__content {
  width: 100%;
  height: auto;
  gap: 0.5rem;
  overflow: visible;
  padding: 0;
  color: var(--elce-appearance-menu-foreground);
  background: transparent;
}`],
  [142, `

.elce-summary--menu .elce-summary__title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}`],
  [143, `

.elce-summary--menu .elce-summary__chapter-title {
  color: var(--elce-appearance-menu-foreground);
}`],
  [144, `

.elce-summary--menu .elce-player-menu__entries {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}`],
  [145, `

.elce-summary--menu .elce-player-menu__pages {
  display: grid;
  gap: 0.12rem;
  margin: 0.15rem 0 0;
  padding: 0 0 0 0.75rem;
  list-style: none;
}`],
  [146, `

.elce-player-menu__summary-slot {
  width: 100%;
  min-height: 0;
}`],
  [147, `

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
}`],
  [148, `

.elce-profile-form__page > h1 {
  margin: 0;
  font-size: 2.82em;
  line-height: 1.2;
}`],
  [149, `

.elce-profile-form__fields {
  display: grid;
  max-width: 48rem;
  gap: 1rem;
}`],
  [150, `

.elce-profile-form__field {
  display: grid;
  gap: 0.6rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.5rem;
  padding: 0.85rem;
}`],
  [151, `

.elce-profile-form__choice {
  padding: 0.2rem 0;
}`],
  [152, `

.elce-profile-form__submit {
  min-height: 2.75rem;
  justify-self: start;
  border: 1px solid var(--elce-appearance-accent);
  border-radius: 0.45rem;
  padding: 0.55rem 1rem;
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
  cursor: pointer;
}`],
  [153, `

.elce-profile-form [role='status']:not(:empty) {
  color: var(--elce-appearance-accent-secondary);
}`],
  [154, `

.elce-player-profile-complete {
  margin: auto;
  padding: 2rem;
  color: var(--elce-appearance-muted);
}`],
] as const
