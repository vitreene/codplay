import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import { ELCE_EVENTS, ELCE_SCENARIO } from './learning-reading-events'
import type { LearningDocument } from '../document/learning-document'
import { documentAppearanceClassNames } from '../../../builders/scene-style/appearance-class-names'

export class LearningLayoutSceneBuilder {
  /** Creates the fixed layout with the five explicit regions of the complete preview. */
  public buildLayoutScene(document: LearningDocument): SceneDoc<string> {
    const documentId = document.id
    const menuPartId = `${documentId}:layout:menu`
    const menuTogglePartId = `${documentId}:layout:menu-toggle`
    const titlePartId = `${documentId}:layout:title`
    const contentPartId = `${documentId}:layout:content`
    const navigationPartId = `${documentId}:layout:navigation`
    const appearanceClassNames = documentAppearanceClassNames(document.data)
    const layoutAppearanceClass = appearanceClassNames['document:layout']
    const contentAppearanceClass = appearanceClassNames['document:content']
    if (layoutAppearanceClass === undefined || contentAppearanceClass === undefined) {
      throw new Error(`Les classes d’apparence du projet ${documentId} sont incomplètes.`)
    }
    return {
      id: `${documentId}-layout-scene`,
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          persos: [
            {
              id: `${documentId}-layout`,
              type: 'layout',
              initial: {
                move: '@root',
                className: `elce-player-layout ${layoutAppearanceClass}`,
                markup: `<main id="${documentId}-layout-root" class="elce-player-layout ${layoutAppearanceClass}">
                  <aside id="${documentId}-menu-region" class="elce-player-layout__menu" aria-label="Menu du document"><!-- data-part="${menuPartId}" --></aside>
                  <header id="${documentId}-title-region" class="elce-player-layout__title" aria-label="Page courante">
                    <!-- data-part="${menuTogglePartId}" -->
                    <!-- data-part="${titlePartId}" -->
                  </header>
                  <!-- data-part="${contentPartId}" -->
                  <nav id="${documentId}-navigation-region" class="elce-player-layout__navigation" aria-label="Navigation des pages">
                    <!-- data-part="${navigationPartId}" -->
                  </nav>
                </main>`,
              },
              actions: {},
            },
            this.createMenuTogglePerso(documentId, menuTogglePartId),
            this.createLayoutSlot(ELCE_SCENARIO.MENU_SLOT, menuPartId, 'elce-player-layout__menu-slot'),
            this.createLayoutSlot(ELCE_SCENARIO.TITLE_SLOT, titlePartId, 'elce-player-layout__title-slot'),
            this.createLayoutSlot(ELCE_SCENARIO.CONTENT_SLOT, contentPartId, `elce-player-layout__content elce-player-layout__content-slot ${contentAppearanceClass}`, {
              tag: 'section',
              attr: { id: `${documentId}-content-region`, 'aria-label': 'Contenu de la page' },
            }),
            this.createLayoutSlot(ELCE_SCENARIO.NAVIGATION_SLOT, navigationPartId, 'elce-player-layout__navigation-slot'),
          ],
        },
      },
    }
  }

  /** Creates one named CodPlay slot in its matching layout region. */
  private createLayoutSlot(
    name: string,
    target: string,
    className: string,
    element: Readonly<{ tag?: string; attr?: Readonly<Record<string, string>> }> = {},
  ): PersoDoc<string> {
    return {
      id: `elce-${name}`,
      name,
      type: 'slot',
      initial: { ...element, move: { target }, className },
      actions: {},
    }
  }

  /** Creates the layout-owned menu trigger with its accessible state actions. */
  private createMenuTogglePerso(documentId: string, target: string): PersoDoc<string> {
    return {
      id: `${documentId}-menu-toggle`,
      type: 'layout',
      initial: {
        move: { target },
        markup: `<button id="${documentId}-menu-toggle" class="elce-player-menu-toggle" type="button" aria-label="Ouvrir le sommaire" aria-controls="${documentId}-menu-drawer-root" aria-expanded="false">
          <svg id="${documentId}-menu-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path id="${documentId}-menu-toggle-icon-path" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>`,
      },
      emit: { click: { event: { name: ELCE_EVENTS.MENU_DRAWER_OPEN, visibility: 'public' } } },
      actions: {
        [ELCE_EVENTS.MENU_DRAWER_OPEN]: { attr: { 'aria-expanded': 'true' } },
        [ELCE_EVENTS.MENU_DRAWER_CLOSE]: { attr: { 'aria-expanded': 'false' } },
      },
    }
  }

  /** Builds the title scene updated by the Sighty presentation action. */
  public createTitleScene(): SceneDoc<string> {
    return {
      id: `${ELCE_SCENARIO.TITLE_SCENE}-document`,
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          listen: [{ on: ELCE_EVENTS.PRESENTATION_TITLE }],
          persos: [{
            id: 'elce-current-title',
            type: 'tag',
            initial: { tag: 'h1', content: 'Titre en attente', className: 'elce-player-title', move: '@root' },
            actions: { [ELCE_EVENTS.PRESENTATION_TITLE]: {} },
          }],
        },
      },
    }
  }

  /** Builds the navigation scene with comment anchors for previous, status, and next. */
  public createNavigationScene(): SceneDoc<string> {
    return {
      id: `${ELCE_SCENARIO.NAVIGATION_SCENE}-document`,
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          listen: [
            { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS },
            { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS },
            { on: ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT },
          ],
          persos: [
            {
              id: 'elce-navigation-controls',
              type: 'layout',
              initial: {
                move: '@root',
                className: 'elce-player-navigation',
                markup: `<div id="elce-navigation-controls-root" class="elce-player-navigation">
                  <!-- data-part="elce:navigation:previous" -->
                  <!-- data-part="elce:navigation:status" -->
                  <!-- data-part="elce:navigation:next" -->
                </div>`,
              },
              actions: {},
            },
            {
              id: 'elce-navigation-previous',
              type: 'tag',
              initial: {
                tag: 'button',
                content: 'Précédent',
                attr: { type: 'button', disabled: true },
                className: 'elce-player-navigation__button',
                move: { target: 'elce:navigation:previous' },
              },
              emit: { click: { event: { name: ELCE_EVENTS.NAVIGATION_PREVIOUS, visibility: 'public' } } },
              actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS]: {} },
            },
            {
              id: 'elce-navigation-status',
              type: 'tag',
              initial: {
                tag: 'p',
                content: '',
                className: 'elce-player-navigation__status',
                move: { target: 'elce:navigation:status' },
              },
              actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS]: {} },
            },
            {
              id: 'elce-navigation-next',
              type: 'tag',
              initial: {
                tag: 'button',
                content: 'Suivant',
                attr: { type: 'button', disabled: true },
                className: 'elce-player-navigation__button elce-player-navigation__button--next',
                move: { target: 'elce:navigation:next' },
              },
              emit: { click: { event: { name: ELCE_EVENTS.NAVIGATION_NEXT, visibility: 'public' } } },
              actions: { [ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT]: {} },
            },
          ],
        },
      },
    }
  }

  /** Creates the visible placeholder page used when a document has no placed page. */
  public createEmptyPageScene(documentId: string): SceneDoc<string> {
    return {
      id: `${documentId}-empty-page-scene`,
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          persos: [{
            id: `${documentId}-empty-page-message`,
            type: 'tag',
            initial: {
              tag: 'p',
              content: 'Aucune page à afficher.',
              className: 'elce-player-empty-page',
              move: '@root',
            },
          }],
        },
      },
    }
  }

  /** Holds the reader briefly while the submitted profile rebuilds its projection. */
  public createProfileCompleteScene(documentId: string): SceneDoc<string> {
    return {
      id: `${documentId}-profile-complete-scene`,
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          persos: [{
            id: `${documentId}-profile-complete-message`,
            type: 'tag',
            initial: {
              tag: 'p',
              content: 'Ouverture du parcours…',
              className: 'elce-player-profile-complete',
              move: '@root',
            },
          }],
        },
      },
    }
  }
}

export const learningLayoutSceneBuilder = new LearningLayoutSceneBuilder()
