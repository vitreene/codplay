import './overlay-world-outlet-repro.css'
import type { SceneDoc } from 'codplay-v1/player/types'

/**
 * Visual repro gathering both current overlay-world problems in one place:
 * 1) outlet -> outlet non-list (no motion today),
 * 2) outlet -> list in footer (motion exists but trajectory can be wrong).
 */
export function createOverlayWorldOutletReproScene(): SceneDoc {
  return {
    id: 'overlay-world-outlet-repro-scene',
    stories: {
      'overlay-world-outlet-repro-story': {
        id: 'overlay-world-outlet-repro-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'owor-container',
            type: 'layout',
            initial: {
              move: '@root',
              markup: `
                <section class="owor-container">
                  <header class="owor-title">Overlay-world : 2 cas a corriger</header>
                  <main class="owor-main">
                    <div class="owor-stage-card">
                      <p class="owor-case-label">Cas 1</p>
                      <p class="owor-stage-copy">Source principale vers cible outlet non-list. Aujourd'hui, on observe surtout l'absence de deplacement.</p>
                      <div class="owor-source-slot" data-part="owor-container:source-slot-outlet"></div>
                    </div>
                    <div class="owor-stage-card">
                      <p class="owor-case-label">Cas 2</p>
                      <p class="owor-stage-copy">Source principale vers cible list dans le footer, avec changement simultane de classe et de positioning comme dans quiz-hunt.</p>
                      <div class="owor-source-slot" data-part="owor-container:source-slot-list"></div>
                    </div>
                  </main>
                  <footer class="owor-footer">
                    <div class="owor-footer-block owor-footer-basket">Panier</div>
                    <div class="owor-footer-center">
                      <div class="owor-footer-caption">Cas 1 : outlet</div>
                      <div class="owor-target-slot" data-part="owor-container:target-slot-outlet"></div>
                    </div>
                    <div class="owor-footer-center">
                      <div class="owor-footer-caption">Cas 2 : list</div>
                      <div class="owor-target-slot" data-part="owor-container:target-slot-list"></div>
                    </div>
                    <div class="owor-footer-block owor-footer-timer">Chrono</div>
                  </footer>
                </section>
              `,
              style: {
                width: '100%',
                height: '100%',
              },
            },
            actions: {},
          },
          {
            id: 'owor-token-outlet',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'E',
              attr: { type: 'button', title: 'Jeton extra - cas 1' },
              className: 'owor-token',
              move: { parentId: 'owor-container:source-slot-outlet' },
            },
            actions: {
              'owor:outlet:move-to-footer': {
                move: {
                  parentId: 'owor-container:target-slot-outlet',
                  flipMode: 'overlay-world',
                  duration: 900,
                  easing: 'easeInOutQuad',
                  attraction: 70,
                },
              },
            },
          },
          {
            id: 'owor-target-list',
            type: 'list',
            initial: {
              move: { parentId: 'owor-container:target-slot-list' },
              className: 'owor-target-list',
            },
            actions: {},
          },
          {
            id: 'owor-token-list',
            type: 'tag',
            initial: {
              tag: 'button',
              content: 'E',
              attr: { type: 'button', title: 'Jeton extra - cas 2' },
              className: 'owor-token owor-token-floating',
              move: { parentId: 'owor-container:source-slot-list' },
            },
            actions: {
              'owor:list:move-to-footer': {
                move: {
                  parentId: 'owor-target-list',
                  flipMode: 'overlay-world',
                  duration: 1100,
                  easing: 'easeOutCubic',
                  attraction: -45,
                },
                className: 'owor-token owor-token-docked',
              },
            },
          },
        ],
        eventimes: [
          { name: 'owor:outlet:move-to-footer', startAt: 1000 },
          { name: 'owor:list:move-to-footer', startAt: 3600 },
          { name: 'sequence:end', startAt: 9000 },
        ],
        listen: [],
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
