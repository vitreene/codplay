import type { SceneDoc } from 'codplay/scene/types'

const STAR_REPLACE_EVENT = 'replace:star-mask'
const IMAGE_A = '/assets/35c8ec5a07fc.jpg'
const IMAGE_B = '/assets/28970388742_2f75d527d6_z.jpg'

type ScenePerso = SceneDoc['stories']['main']['persos'][number]

/** Creates one isolated CodPlay media replace with the SVG star-cell mask. */
export function createScene(): SceneDoc {
  return {
    id: 'replace-mask-star-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [createStage(), createImage()],
        eventimes: [{ name: STAR_REPLACE_EVENT, startAt: 1_200 }],
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: 4_000 }],
  }
}

/** Creates the one-media host so the authored SVG mask stays easy to inspect. */
function createStage(): ScenePerso {
  return {
    id: 'replace-star-stage',
    type: 'layout',
    initial: {
      move: '@root',
      markup: `
        <section id="replace-star-stage-frame" class="replace-star-stage">
          <header id="replace-star-stage-heading" class="replace-star-stage__heading">
            <p id="replace-star-stage-eyebrow" class="replace-star-stage__eyebrow">CODEPLAY · REPLACE-MEDIA · SPLIT CELLS</p>
            <h2 id="replace-star-stage-title">Une forme SVG, une grille, un média</h2>
            <p id="replace-star-stage-description">La zone magenta montre le masque autour des étoiles. La télécommande permet d’inspecter la transition au cours de sa progression.</p>
          </header>
          <figure id="replace-star-media-frame" class="replace-star-media-frame">
            <figcaption id="replace-star-media-label">Étoile · taille de cellule 8 % de la largeur du média</figcaption>
            <div id="replace-star-media-outlet" class="replace-star-media-outlet" data-part="replace-star-stage:media"></div>
          </figure>
        </section>
      `,
    },
    actions: {},
  }
}

/** Creates the single image pair that exposes the star-mask geometry. */
function createImage(): ScenePerso {
  return {
    id: 'replace-star-image',
    type: 'img',
    initial: {
      src: IMAGE_A,
      className: 'replace-star-media',
      img: { style: { objectFit: 'cover' } },
      move: { target: 'replace-star-stage:media' },
    },
    actions: {
      [STAR_REPLACE_EVENT]: {
        src: IMAGE_B,
        replace: {
          transition: 'mask-reveal',
          duration: 1_100,
          split: 'cells',
          shape: 'star',
          cellSize: 8,
          direction: 'center',
          stagger: 22,
        },
      },
    },
  }
}
