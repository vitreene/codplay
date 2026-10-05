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
  color: #1d2d35;
  background: #fffdf8;
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
  border: 1px solid #8aa19b;
  border-radius: 0.45rem;
  color: #fff;
  background: #263b3a;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.elce-player-menu-toggle-host,
.elce-player-menu-close-host {
  display: contents;
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
  color: #f8fafc;
  background: #263b3a;
}

.elce-player-layout__title {
  display: flex;
  min-height: 4.25rem;
  grid-area: title;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid #d9d4c9;
  background: #fffdf8;
}

.elce-player-layout__content {
  grid-area: content;
  min-height: 0;
  overflow: hidden;
  background: #fffdf8;
}

.elce-player-layout__navigation {
  min-height: 4rem;
  grid-area: navigation;
  border-top: 1px solid #d9d4c9;
  background: #fffdf8;
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
}

.elce-player-layout__title-slot-host {
  min-width: 0;
  height: 100%;
  flex: 1;
}

.elce-player-title {
  margin: 0;
  color: #263b3a;
  font-size: clamp(1.1rem, 2.5vw, 1.75rem);
  line-height: 1.2;
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
  border-bottom: 1px solid rgb(255 255 255 / 20%);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
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
  color: #f8fafc;
  font-size: 0.82rem;
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
  color: #dce5ef;
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
  border-left-color: #8bd4c7;
  color: #fff;
  background: rgb(255 255 255 / 12%);
}

.elce-player-menu__page-button[data-locked='true'] {
  color: #9baaba;
  font-style: italic;
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
  border: 1px solid #b7c9c4;
  border-radius: 0.45rem;
  color: #263b3a;
  background: #fff;
  font-weight: 700;
  cursor: pointer;
}

.elce-player-navigation__button--next {
  border-color: #46726b;
  color: #fff;
  background: #46726b;
}

.elce-player-navigation__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.elce-player-navigation__status {
  margin: 0;
  color: #67736f;
  font-size: 0.78rem;
  text-align: center;
}

.elce-player-empty-page {
  margin: auto;
  padding: 2rem;
  color: #67736f;
}

.elce-flux-scrollport {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.elce-flux-article {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: clamp(1rem, 3vw, 2rem);
  box-sizing: border-box;
}

.elce-flux-article > section {
  width: 100%;
  flex: 0 0 auto;
  position: relative;
}

.elce-card--carousel {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #d5ddd8;
  border-radius: 0.65rem;
  background: #f8faf8;
}

.elce-carousel__frame {
  width: 100%;
  min-width: 0;
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

.elce-card--text-short {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  gap: clamp(0.25rem, 1.2cqw, 0.8rem);
  padding: clamp(1rem, 4cqw, 3rem);
  overflow: hidden;
  color: #263b3a;
  text-align: center;
}

.elce-card--text-short > p,
.elce-card--text-short > h2,
.elce-card--text-short > footer {
  margin: 0;
}

.elce-card--text-short [data-part$=':overline'],
.elce-card--text-short [data-part$=':note'] {
  color: #647670;
  font-size: clamp(0.7rem, 1.5cqw, 0.95rem);
}

.elce-card--text-short [data-part$=':title'] {
  font-size: clamp(1.25rem, 3.5cqw, 2.4rem);
  line-height: 1.1;
}

.elce-card--text-short [data-part$=':description'] {
  color: #52645f;
  font-size: clamp(0.85rem, 1.8cqw, 1.15rem);
}

.elce-card--text-short [data-part$=':message'] {
  font-size: clamp(0.95rem, 2.2cqw, 1.45rem);
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
  color: #263b3a;
}

.elce-carousel-view--image-right .elce-card--text-image {
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  grid-template-areas: 'content image';
}

.elce-card--text-image > [data-part$=':image'] {
  min-width: 0;
  min-height: 0;
  grid-area: image;
  overflow: hidden;
}

.elce-card--text-image > [data-part$=':content'] {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  grid-area: content;
  gap: clamp(0.25rem, 1.2cqw, 0.8rem);
  padding: clamp(0.75rem, 3cqw, 2rem);
  overflow: hidden;
}

.elce-card--text-image > [data-part$=':content'] > p,
.elce-card--text-image > [data-part$=':content'] > h2,
.elce-card--text-image > [data-part$=':content'] > footer {
  margin: 0;
}

.elce-card--text-image [data-part$=':overline'],
.elce-card--text-image [data-part$=':note'] {
  color: #647670;
  font-size: clamp(0.7rem, 1.5cqw, 0.95rem);
}

.elce-card--text-image [data-part$=':title'] {
  font-size: clamp(1.1rem, 3cqw, 2rem);
  line-height: 1.1;
}

.elce-card--text-image [data-part$=':description'] {
  color: #52645f;
  font-size: clamp(0.8rem, 1.6cqw, 1.05rem);
}

.elce-card--text-image [data-part$=':message'] {
  font-size: clamp(0.85rem, 1.8cqw, 1.2rem);
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

.elce-card--photo > [data-part$=':media'] {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.elce-carousel-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.elce-card--image-caption {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.elce-card--image-caption > [data-part$=':image'] {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.elce-card--image-caption > [data-part$=':caption'] {
  margin: 0;
  padding: 0.45rem 0.75rem;
  color: #52645f;
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
  border: 1px solid #9db0a9;
  border-radius: 50%;
  color: #526b66;
  background: #fff;
  line-height: 1;
}

.elce-carousel-dot--active {
  border-color: #46726b;
  color: #fff;
  background: #46726b;
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
  object-fit: cover;
}

.elce-flux-image > img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.elce-flux-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.elce-card--question {
  width: 100%;
  padding: clamp(1rem, 3vw, 1.6rem);
  border: 1px solid #d5ddd8;
  border-radius: 0.65rem;
  background: #f8faf8;
}

.elce-card--question header {
  margin-bottom: 0.8rem;
}

.elce-card--question header h2 {
  margin: 0;
  color: #263b3a;
  font-size: clamp(1.1rem, 2.3vw, 1.5rem);
}

.elce-card--question [data-part$=':illustration'] {
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
  color: #263b3a;
  font-size: clamp(1.05rem, 2.2vw, 1.4rem);
  font-weight: 700;
  line-height: 1.4;
}

.elce-question-instructions {
  margin: 0 0 0.5rem;
  color: #65736d;
  font-size: 0.85rem;
}

.elce-card--question [data-part$=':answers'] {
  display: grid;
  gap: 0.55rem;
}

.elce-card--question .input {
  padding: 0.6rem 0.75rem;
  border: 1px solid #d5ddd8;
  border-radius: 0.5rem;
  background: #fff;
}

.elce-question-validate {
  margin-top: 0.8rem;
  padding: 0.58rem 0.9rem;
  border: 0;
  border-radius: 0.45rem;
  color: #fff;
  background: #46726b;
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

.elce-evaluation-result--pending .elce-evaluation-result__branch,
.elce-evaluation-result--success .elce-evaluation-result__branch--failure,
.elce-evaluation-result--failure .elce-evaluation-result__branch--success {
  display: none;
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
    background: rgb(20 29 28 / 62%);
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
    background: #263b3a;
    box-shadow: 0.75rem 0 2rem rgb(20 29 28 / 25%);
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

  .elce-player-menu-panel-host {
    width: 100%;
    height: 100%;
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
`
