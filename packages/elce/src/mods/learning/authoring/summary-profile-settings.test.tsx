// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'remix/ui/test'
import { CATALOG_REFERENCE } from '../../../core/catalog/catalog-config'
import { MEDIA_FILE_ACCEPT } from '../../../core/media/media-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { learningControllerMachine as controllerMachine } from './learning-controller-machine'
import { LearningEditorFacade } from './learning-editor-facade'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import type { ProfileDefinition, ProfileProperty } from '../profile/domain/learning-profile-types'
import { renderSummaryProfileSettings } from './summary-profile-settings'

describe('Sommaire et profils auteur', () => {
  it('ne garde que les réglages du Sommaire si le flag Profil est désactivé', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    const constraint = {
      id: 'chapter-audience-rule',
      target: { kind: 'chapter' as const, id: 'chapter-1' },
      conditions: [{
        propertyId: property.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'staff' },
        joinWithNext: null,
      }],
    }
    const initialProfile = controller.getSnapshot().context.document.data.profile
    actions.updateProfileDefinition({ ...initialProfile, properties: [property], constraints: [constraint] })
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      summaryProfileEditingEnabled: false,
      onClose,
      onError: () => undefined,
    }))

    expect(rendered.$('#elce-summary-settings')).not.toBeNull()
    expect(rendered.$('#elce-profile-properties')).toBeNull()
    expect(rendered.$('#elce-profile-constraint-layout')).toBeNull()
    expect(rendered.$('#elce-profile-constraints-form')).toBeNull()

    const title = rendered.$('#elce-summary-title') as HTMLInputElement
    await rendered.act(() => {
      title.value = 'Sommaire modifié'
      title.dispatchEvent(new Event('blur', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.data.summary.title).toBe('Sommaire modifié')

    await rendered.act(() => rendered.$('#elce-summary-profile-settings-save')?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(onClose).toHaveBeenCalledOnce()
    expect(controller.getSnapshot().context.document.data.profile.properties).toEqual([property])
    expect(controller.getSnapshot().context.document.data.profile.constraints).toEqual([constraint])

    rendered.cleanup()
    controller.stop()
  })

  it('utilise le sélecteur d’illustration partagé pour le fond du Sommaire', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const importBackground = vi.spyOn(actions, 'importSummaryBackgroundFile').mockImplementation(() => undefined)
    let document = controller.getSnapshot().context.document
    let rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))

    const picker = rendered.$('#elce-summary-background-illustration') as HTMLLabelElement
    const fileInput = rendered.$('#elce-summary-background-illustration-file') as HTMLInputElement
    const selectedImage = new File(['background'], 'fond.jpg', { type: 'image/jpeg' })
    expect(picker.classList.contains('elce-media-picker')).toBe(true)
    expect(fileInput.accept).toBe(MEDIA_FILE_ACCEPT.IMAGE)
    await rendered.act(() => {
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [selectedImage] })
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(importBackground).toHaveBeenCalledWith(selectedImage)

    rendered.cleanup()
    const background = {
      id: 'media-summary-background',
      name: 'fond.jpg',
      mimeType: 'image/jpeg',
      size: selectedImage.size,
      caption: '',
    }
    controller.send({ type: 'document.apply', command: { type: 'media.add', media: background } })
    actions.updateSummarySettings({ ...document.data.summary, backgroundMediaId: background.id })
    const alternativeBackground = { ...background, id: 'media-summary-background-alternative', name: 'autre-fond.jpg' }
    controller.send({ type: 'document.apply', command: { type: 'media.add', media: alternativeBackground } })
    document = controller.getSnapshot().context.document
    rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {
        [background.id]: 'blob:summary-background',
        [alternativeBackground.id]: 'blob:summary-background-alternative',
      },
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    expect((rendered.$('#elce-summary-background-media-image') as HTMLImageElement).src).toBe('blob:summary-background')

    await rendered.act(() => {
      const drop = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(drop, 'dataTransfer', {
        value: {
          files: [],
          getData: (type: string) => type === CATALOG_REFERENCE.MIME_TYPE
            ? JSON.stringify({ kind: CATALOG_REFERENCE.MEDIA, mediaId: alternativeBackground.id })
            : '',
        },
      })
      rendered.$('#elce-summary-background-illustration')?.dispatchEvent(drop)
    })
    expect(controller.getSnapshot().context.document.data.summary.backgroundMediaId).toBe(alternativeBackground.id)

    rendered.cleanup()
    document = controller.getSnapshot().context.document
    rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: { [alternativeBackground.id]: 'blob:summary-background-alternative' },
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    await rendered.act(() => rendered.$('#elce-summary-background-media-clear')?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(controller.getSnapshot().context.document.data.summary.backgroundMediaId).toBeNull()
    rendered.cleanup()
    controller.stop()
  })

  it('désactive « Sommaire dans la navigation » tant que la page Sommaire racine est désactivée', () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const initial = controller.getSnapshot().context.document
    actions.updateSummarySettings({ ...initial.data.summary, permanentAccess: true })
    let document = controller.getSnapshot().context.document
    let rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    const disabledControl = rendered.$('#elce-summary-permanent-access') as HTMLInputElement
    expect(disabledControl.disabled).toBe(true)
    expect(disabledControl.checked).toBe(true)

    rendered.cleanup()
    actions.updateSummarySettings({ ...document.data.summary, showAtRoot: true })
    document = controller.getSnapshot().context.document
    rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    expect((rendered.$('#elce-summary-permanent-access') as HTMLInputElement).disabled).toBe(false)

    rendered.cleanup()
    controller.stop()
  })

  it('propose la fin de page par défaut et enregistre le mode libre', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const document = controller.getSnapshot().context.document
    const rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    const continuation = rendered.$('#elce-summary-page-continuation') as HTMLSelectElement

    expect(continuation.value).toBe('endpage')
    await rendered.act(() => {
      continuation.value = 'free'
      continuation.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.data.summary.pageContinuationMode).toBe('free')

    rendered.cleanup()
    controller.stop()
  })

  it('sélectionner un chapitre sélectionne ses pages sans confondre les cibles enfant', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' })
    actions.createChapter(controller.getSnapshot().context.document)
    const currentProfile = controller.getSnapshot().context.document.data.profile
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    actions.updateProfileDefinition({ ...currentProfile, properties: [property] })
    const document = controller.getSnapshot().context.document
    const rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))

    const chapterCheckbox = rendered.$('#elce-profile-target-item-chapter-chapter-1-checkbox') as HTMLInputElement
    const pageCheckboxes = Array.from(
      rendered.$('#elce-profile-constraint-target-tree')?.querySelectorAll<HTMLInputElement>('input[name="targets"]') ?? [],
    ).filter((checkbox) => checkbox.value.startsWith('page:'))
    const firstPageCheckbox = pageCheckboxes.find((checkbox) => checkbox.value === 'page:page-a')
    const constraintsEditor = rendered.$('#elce-constraints-editor') as HTMLFieldSetElement
    const profileEditor = rendered.$('#elce-profile-rule-editor') as HTMLFieldSetElement
    const readingPrerequisites = rendered.$('#elce-reading-prerequisites') as HTMLSelectElement
    expect(pageCheckboxes).toHaveLength(2)
    expect(firstPageCheckbox).not.toBeUndefined()
    expect(rendered.$('#elce-profile-property-default-profile-audience-control')).not.toBeNull()
    expect(rendered.$('#elce-profile-rule-fields')).not.toBeNull()
    expect(rendered.$('#elce-reading-rule-fields')).not.toBeNull()
    expect(constraintsEditor.disabled).toBe(true)
    expect(profileEditor.matches(':disabled')).toBe(true)
    expect(readingPrerequisites.matches(':disabled')).toBe(true)

    await rendered.act(() => {
      chapterCheckbox.click()
    })
    expect(constraintsEditor.disabled).toBe(false)
    expect(profileEditor.matches(':disabled')).toBe(false)
    expect(rendered.$('#elce-profile-visibility-property-1')).not.toBeNull()
    expect(readingPrerequisites.matches(':disabled')).toBe(false)
    expect(Array.from(readingPrerequisites.selectedOptions, (option) => option.value)).toEqual(['ignore'])
    expect(rendered.$('#elce-constraints-selection-state')?.textContent)
      .toBe(`${pageCheckboxes.length + 1} éléments sélectionnés.`)
    expect(pageCheckboxes.every((checkbox) => checkbox.checked)).toBe(true)
    expect(chapterCheckbox.checked).toBe(true)
    expect(chapterCheckbox.indeterminate).toBe(false)

    await rendered.act(() => {
      if (firstPageCheckbox === undefined) throw new Error('The first chapter page was not rendered.')
      firstPageCheckbox.click()
    })
    expect(firstPageCheckbox?.checked).toBe(false)
    expect(chapterCheckbox.checked).toBe(false)
    expect(chapterCheckbox.indeterminate).toBe(true)

    await rendered.act(() => {
      chapterCheckbox.click()
    })
    expect(pageCheckboxes.every((checkbox) => checkbox.checked)).toBe(true)
    expect(chapterCheckbox.checked).toBe(true)
    expect(chapterCheckbox.indeterminate).toBe(false)

    await rendered.act(() => {
      chapterCheckbox.click()
    })
    expect(pageCheckboxes.every((checkbox) => !checkbox.checked)).toBe(true)
    expect(chapterCheckbox.checked).toBe(false)
    expect(chapterCheckbox.indeterminate).toBe(false)
    expect(constraintsEditor.disabled).toBe(true)

    await rendered.act(() => {
      for (const checkbox of pageCheckboxes) {
        checkbox.click()
      }
    })
    expect(pageCheckboxes.every((checkbox) => checkbox.checked)).toBe(true)
    expect(chapterCheckbox.checked).toBe(false)
    expect(chapterCheckbox.indeterminate).toBe(true)
    rendered.cleanup()
    controller.stop()
  })

  it('applique la règle au chapitre entier et la transmet aux pages créées ensuite', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    const initialProfile = controller.getSnapshot().context.document.data.profile
    actions.updateProfileDefinition({ ...initialProfile, properties: [property] })
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      onClose,
      onError: () => undefined,
    }))

    const saveButton = rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement
    await rendered.act(() => {
      const chapter = rendered.$('#elce-profile-target-item-chapter-chapter-1-checkbox') as HTMLInputElement
      chapter.click()
      const value = rendered.$('#elce-profile-visibility-text-value-1') as HTMLInputElement
      value.value = 'teacher'
      value.dispatchEvent(new Event('input', { bubbles: true }))
      saveButton.click()
    })

    expect(onClose).toHaveBeenCalledOnce()
    const savedProfile = controller.getSnapshot().context.document.data.profile
    expect(savedProfile.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [expect.objectContaining({ propertyId: property.id, condition: { kind: 'text', operator: 'equals', value: 'teacher' } })],
      }),
      expect.objectContaining({
        target: { kind: 'page', id: 'page-a' },
        conditions: [expect.objectContaining({ propertyId: property.id, condition: { kind: 'text', operator: 'equals', value: 'teacher' } })],
      }),
    ]))

    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' })
    const futurePage = controller.getSnapshot().context.document.pages.at(-1)
    if (futurePage === undefined) throw new Error('The future chapter page fixture was not created.')
    actions.createSection(futurePage.id, 0)
    const futureSection = controller.getSnapshot().context.document.pages.at(-1)?.bdcIds[0]
    if (futureSection === undefined) throw new Error('The future chapter Section fixture was not created.')
    expect(learningProfileService.profileVisibilityForBdc(controller.getSnapshot().context.document, futureSection)).toEqual(
      expect.objectContaining({
        target: { kind: 'chapter', id: 'chapter-1' },
        conditions: [{
          propertyId: property.id,
          condition: { kind: 'text', operator: 'equals', value: 'teacher' },
          joinWithNext: null,
        }],
      }),
    )
    rendered.cleanup()
    controller.stop()
  })

  it('garde une page seule comme exception locale même si elle est le seul contenu du chapitre', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    const initialProfile = controller.getSnapshot().context.document.data.profile
    const chapterRule = {
      id: 'chapter-audience-rule',
      target: { kind: 'chapter' as const, id: 'chapter-1' },
      conditions: [{
        propertyId: property.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'student' },
        joinWithNext: null,
      }],
    }
    actions.updateProfileDefinition({ ...initialProfile, properties: [property], constraints: [chapterRule] })
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      onClose,
      onError: () => undefined,
    }))

    const chapterCheckbox = rendered.$('#elce-profile-target-item-chapter-chapter-1-checkbox') as HTMLInputElement
    const pageCheckbox = rendered.$('#elce-profile-target-item-page-page-a-checkbox') as HTMLInputElement
    const saveButton = rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement
    await rendered.act(() => {
      pageCheckbox.click()
    })
    expect(chapterCheckbox.checked).toBe(false)
    expect(chapterCheckbox.indeterminate).toBe(true)

    await rendered.act(() => {
      const value = rendered.$('#elce-profile-visibility-text-value-1') as HTMLInputElement
      value.value = 'teacher'
      value.dispatchEvent(new Event('input', { bubbles: true }))
      saveButton.click()
    })

    expect(onClose).toHaveBeenCalledOnce()
    let document = controller.getSnapshot().context.document
    expect(document.data.profile.constraints).toEqual(expect.arrayContaining([
      chapterRule,
      expect.objectContaining({
        target: { kind: 'page', id: 'page-a' },
        conditions: [{
          propertyId: property.id,
          condition: { kind: 'text', operator: 'equals', value: 'teacher' },
          joinWithNext: null,
        }],
      }),
    ]))
    expect(learningProfileService.profileVisibilityForBdc(document, 'bdc-section-1')).toEqual(expect.objectContaining({
      target: { kind: 'page', id: 'page-a' },
      conditions: [expect.objectContaining({ condition: { kind: 'text', operator: 'equals', value: 'teacher' } })],
    }))

    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' })
    const futurePage = controller.getSnapshot().context.document.pages.at(-1)
    if (futurePage === undefined) throw new Error('The future chapter page fixture was not created.')
    actions.createSection(futurePage.id, 0)
    const futureSection = controller.getSnapshot().context.document.pages.at(-1)?.bdcIds[0]
    if (futureSection === undefined) throw new Error('The future chapter Section fixture was not created.')
    document = controller.getSnapshot().context.document
    expect(learningProfileService.profileVisibilityForBdc(document, futureSection)).toEqual(expect.objectContaining({
      target: { kind: 'chapter', id: 'chapter-1' },
      conditions: [expect.objectContaining({ condition: { kind: 'text', operator: 'equals', value: 'student' } })],
    }))
    rendered.cleanup()
    controller.stop()
  })

  it('ajoute des conditions sur une ligne et enregistre le connecteur ET ou OU entre elles', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    actions.updateProfileDefinition({
      ...controller.getSnapshot().context.document.data.profile,
      properties: [property],
    })
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      onClose,
      onError: () => undefined,
    }))

    await rendered.act(() => {
      (rendered.$('#elce-profile-target-item-chapter-chapter-1-checkbox') as HTMLInputElement).click()
    })
    const conditions = rendered.$('#elce-profile-visibility-conditions') as HTMLElement
    const firstValue = conditions.querySelector<HTMLInputElement>('[data-profile-condition-value="text"]')
    expect(firstValue).not.toBeNull()
    expect(firstValue?.closest('[data-profile-visibility-row]')?.querySelector('[data-profile-condition-kind="text"]')).not.toBeNull()
    await rendered.act(() => {
      if (firstValue === null) throw new Error('The first visibility condition was not rendered.')
      firstValue.value = 'teacher'
      firstValue.dispatchEvent(new Event('input', { bubbles: true }))
      rendered.$('#elce-profile-visibility-add')?.dispatchEvent(new Event('click', { bubbles: true }))
    })
    const rows = conditions.querySelectorAll<HTMLElement>('[data-profile-visibility-row]')
    expect(rows).toHaveLength(2)
    await rendered.act(() => {
      const secondValue = rows[1]?.querySelector<HTMLInputElement>('[data-profile-condition-value="text"]')
      if (secondValue === undefined || secondValue === null) throw new Error('The second visibility condition was not rendered.')
      secondValue.value = 'staff'
      secondValue.dispatchEvent(new Event('input', { bubbles: true }))
      const join = rows[0]?.querySelector<HTMLSelectElement>('[data-profile-visibility-join]')
      if (join === undefined || join === null) throw new Error('The join selector was not rendered between conditions.')
      join.value = 'or'
      join.dispatchEvent(new Event('change', { bubbles: true }))
      ;(rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement).click()
    })

    expect(onClose).toHaveBeenCalledOnce()
    const document = controller.getSnapshot().context.document
    const chapterVisibility = document.data.profile.constraints.find((entry) => entry.target.kind === 'chapter')
    expect(chapterVisibility?.conditions).toEqual([
      { propertyId: property.id, condition: { kind: 'text', operator: 'equals', value: 'teacher' }, joinWithNext: 'or' },
      { propertyId: property.id, condition: { kind: 'text', operator: 'equals', value: 'staff' }, joinWithNext: null },
    ])
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [property.id]: 'teacher' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [property.id]: 'staff' })).toBe(true)
    expect(learningProfileService.bdcMatchesProfile(document, 'bdc-section-1', { [property.id]: 'other' })).toBe(false)
    rendered.cleanup()
    controller.stop()
  })

  it('supprime la liste locale vide et restaure toute la visibilité héritée', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    const chapterVisibility = {
      id: 'chapter-visibility',
      target: { kind: 'chapter' as const, id: 'chapter-1' },
      conditions: [{
        propertyId: property.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'student' },
        joinWithNext: null,
      }],
    }
    const pageVisibility = {
      id: 'page-visibility',
      target: { kind: 'page' as const, id: 'page-a' },
      conditions: [{
        propertyId: property.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'teacher' },
        joinWithNext: null,
      }],
    }
    actions.updateProfileDefinition({
      ...controller.getSnapshot().context.document.data.profile,
      properties: [property],
      constraints: [chapterVisibility, pageVisibility],
    })
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))

    await rendered.act(() => {
      (rendered.$('#elce-profile-target-item-page-page-a-checkbox') as HTMLInputElement).click()
    })
    await rendered.act(() => {
      rendered.$('#elce-profile-visibility-conditions [data-profile-visibility-action="remove"]')
        ?.dispatchEvent(new Event('click', { bubbles: true }))
      expect(rendered.$('#elce-profile-visibility-conditions [data-profile-visibility-row]')).toBeNull()
      ;(rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement).click()
    })

    const document = controller.getSnapshot().context.document
    expect(document.data.profile.constraints).toEqual([chapterVisibility])
    expect(learningProfileService.profileVisibilityForBdc(document, 'bdc-section-1')).toEqual(chapterVisibility)
    rendered.cleanup()
    controller.stop()
  })

  it('enregistre et revient au scénario sans cible de contrainte sélectionnée', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const onClose = vi.fn()
    const onError = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: null,
      onClose,
      onError,
    }))

    const saveButton = rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement
    expect(saveButton.textContent).toBe('Enregistrer')
    expect(saveButton.form?.id).toBe('elce-profile-constraints-form')
    await rendered.act(() => saveButton.click())

    expect(onError).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalledOnce()
    rendered.cleanup()
    controller.stop()
  })

  it('reste ouvert tant qu’une erreur de saisie est affichée', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document: controller.getSnapshot().context.document,
      mediaSources: {},
      actions,
      error: 'Corrigez la valeur par défaut avant de continuer.',
      onClose,
      onError: vi.fn(),
    }))

    await rendered.act(() => (rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement).click())

    expect(rendered.$('#elce-summary-profile-error')?.textContent)
      .toBe('Corrigez la valeur par défaut avant de continuer.')
    expect(onClose).not.toHaveBeenCalled()
    rendered.cleanup()
    controller.stop()
  })

  it('sélectionne les cibles dans le Sommaire et enregistre ensemble les deux familles de contraintes', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    actions.createChapter(controller.getSnapshot().context.document)
    actions.createChapter(controller.getSnapshot().context.document)
    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' })
    const secondChapter = controller.getSnapshot().context.document.chapters[1]
    const thirdChapter = controller.getSnapshot().context.document.chapters[2]
    const additionalPageId = controller.getSnapshot().context.document.chapters[0]?.pageIds[1]
    if (secondChapter === undefined) throw new Error('The second chapter fixture was not created.')
    if (thirdChapter === undefined) throw new Error('The third chapter fixture was not created.')
    if (additionalPageId === undefined) throw new Error('The chapter partial-selection fixture was not created.')

    const property: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    const existingBdcConstraint = {
      id: 'bdc-rule',
      target: { kind: 'bdc' as const, id: 'bdc-section-1' },
      conditions: [{
        propertyId: property.id,
        condition: { kind: 'text' as const, operator: 'equals' as const, value: 'staff' },
        joinWithNext: null,
      }],
    }
    const profile: ProfileDefinition = {
      ...controller.getSnapshot().context.document.data.profile,
      properties: [property],
      constraints: [
        {
          id: 'page-rule',
          target: { kind: 'page', id: 'page-a' },
          conditions: [{
            propertyId: property.id,
            condition: { kind: 'text', operator: 'equals', value: 'student' },
            joinWithNext: null,
          }],
        },
        existingBdcConstraint,
      ],
    }
    actions.updateProfileDefinition(profile)
    const document = controller.getSnapshot().context.document
    const onClose = vi.fn()
    const rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose,
      onError: () => undefined,
    }))

    const targetPanel = rendered.$('#elce-profile-constraint-target-panel') as HTMLElement
    const targetTree = rendered.$('#elce-profile-constraint-target-tree') as HTMLElement
    const layout = rendered.$('#elce-profile-constraint-layout') as HTMLElement
    const editor = rendered.$('#elce-constraints-editor') as HTMLFieldSetElement
    const form = rendered.$('#elce-profile-constraints-form') as HTMLFormElement
    expect(rendered.$('#elce-summary-permanent-access-label')?.textContent).toBe('Sommaire dans la navigation')
    expect(layout.classList.contains('elce-profile-constraint-layout')).toBe(true)
    expect(Array.from(layout.children, (child) => (child as HTMLElement).id)).toEqual([
      'elce-profile-constraint-target-panel',
      'elce-profile-constraint-editor-panel',
    ])
    expect(targetPanel.querySelector('button')).toBeNull()
    expect(targetTree.querySelector('#elce-profile-target-item-chapter-chapter-1 #elce-profile-target-item-page-page-a-checkbox')).not.toBeNull()
    expect(Array.from(targetTree.querySelectorAll<HTMLInputElement>('input[name="targets"]'), (input) => input.value))
      .toEqual(['chapter:chapter-1', 'page:page-a', `page:${additionalPageId}`, `chapter:${secondChapter.id}`, `chapter:${thirdChapter.id}`])
    expect(editor.disabled).toBe(true)
    const saveButton = rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement
    expect(saveButton.form).toBe(form)
    expect(form.querySelectorAll('button[type="submit"]')).toHaveLength(0)
    expect(rendered.$('#elce-profile-rule-save')).toBeNull()
    expect(rendered.$('#elce-reading-rule-save')).toBeNull()
    expect(rendered.$('#elce-profile-visibility-row-1')).toBeNull()
    expect(rendered.$('#elce-reading-prerequisites')).not.toBeNull()

    await rendered.act(() => {
      for (const id of ['elce-profile-target-item-page-page-a-checkbox', `elce-profile-target-item-chapter-${secondChapter.id}-checkbox`]) {
        const checkbox = rendered.$(`#${id}`) as HTMLInputElement
        checkbox.click()
      }
    })
    expect(editor.disabled).toBe(false)
    const firstChapterCheckbox = rendered.$('#elce-profile-target-item-chapter-chapter-1-checkbox') as HTMLInputElement
    expect(firstChapterCheckbox.checked).toBe(false)
    expect(firstChapterCheckbox.indeterminate).toBe(true)
    expect(rendered.$('#elce-profile-rule-current-state')?.textContent).toContain('Visibilités différentes')

    await rendered.act(() => {
      const value = rendered.$('#elce-profile-visibility-conditions [data-profile-condition-value="text"]') as HTMLInputElement
      expect(value).not.toBeNull()
      value.value = 'teacher'
      value.dispatchEvent(new Event('input', { bubbles: true }))
      const effect = rendered.$('#elce-profile-visibility-unmet-behavior') as HTMLSelectElement
      effect.value = 'lock'
      effect.dispatchEvent(new Event('change', { bubbles: true }))
      const requiredChapters = rendered.$('#elce-reading-prerequisites') as HTMLSelectElement
      const previousOption = requiredChapters.querySelector<HTMLOptionElement>('option[value="previous"]')
      const firstRequiredChapter = requiredChapters.querySelector<HTMLOptionElement>('option[value="chapter:chapter-1"]')
      const secondRequiredChapter = requiredChapters.querySelector<HTMLOptionElement>(`option[value="chapter:${thirdChapter.id}"]`)
      if (previousOption === null || firstRequiredChapter === null || secondRequiredChapter === null) {
        throw new Error('Les choix de prérequis attendus ne sont pas rendus.')
      }
      previousOption.selected = true
      requiredChapters.dispatchEvent(new Event('change', { bubbles: true }))
      expect(Array.from(requiredChapters.selectedOptions, (option) => option.value)).toEqual(['previous'])
      previousOption.selected = false
      firstRequiredChapter.selected = true
      secondRequiredChapter.selected = true
      requiredChapters.dispatchEvent(new Event('change', { bubbles: true }))
      expect(Array.from(requiredChapters.selectedOptions, (option) => option.value)).toEqual([
        'chapter:chapter-1', `chapter:${thirdChapter.id}`,
      ])
      saveButton.click()
    })

    expect(onClose).toHaveBeenCalledOnce()
    const savedProfile = controller.getSnapshot().context.document.data.profile
    expect(savedProfile.constraints).toHaveLength(3)
    expect(savedProfile.constraints).toContainEqual(existingBdcConstraint)
    expect(savedProfile.constraints.filter((rule) => rule.target.id === 'page-a' || rule.target.id === secondChapter.id)
      .map((rule) => rule.conditions[0]?.condition))
      .toEqual([
        { kind: 'text', operator: 'equals', value: 'teacher' },
        { kind: 'text', operator: 'equals', value: 'teacher' },
      ])
    expect(savedProfile.constraints.filter((rule) => rule.target.id === 'page-a' || rule.target.id === secondChapter.id)
      .map((rule) => rule.unmetBehavior)).toEqual(['lock', 'lock'])
    expect(savedProfile.readingConstraints).toEqual([{
      id: expect.any(String),
      target: { kind: 'chapter', id: secondChapter.id },
      requirement: { kind: 'chapters', chapterIds: ['chapter-1', thirdChapter.id] },
    }])

    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId: secondChapter.id })
    const futurePage = controller.getSnapshot().context.document.pages.at(-1)
    if (futurePage === undefined) throw new Error('The future-page fixture was not created.')
    actions.createSection(futurePage.id, 0)
    const futureSection = controller.getSnapshot().context.document.pages.at(-1)?.bdcIds[0]
    if (futureSection === undefined) throw new Error('The future-page Section was not created.')
    expect(learningProfileService.profileVisibilityForBdc(controller.getSnapshot().context.document, futureSection)).toEqual(expect.objectContaining({
      target: { kind: 'chapter', id: secondChapter.id },
      conditions: [expect.objectContaining({ condition: { kind: 'text', operator: 'equals', value: 'teacher' } })],
    }))

    rendered.cleanup()
    controller.stop()
  })

  it('enregistre « Précédent » comme choix exclusif du prérequis', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    actions.createChapter(controller.getSnapshot().context.document)
    const secondChapter = controller.getSnapshot().context.document.chapters[1]
    if (secondChapter === undefined) throw new Error('Le second chapitre fixture est absent.')
    const document = controller.getSnapshot().context.document
    const rendered = render(renderSummaryProfileSettings({
      document,
      mediaSources: {},
      actions,
      error: null,
      onClose: () => undefined,
      onError: () => undefined,
    }))
    const target = rendered.$(`#elce-profile-target-item-chapter-${secondChapter.id}-checkbox`) as HTMLInputElement
    const prerequisites = rendered.$('#elce-reading-prerequisites') as HTMLSelectElement
    const ignoreOption = prerequisites.querySelector<HTMLOptionElement>('option[value="ignore"]')
    const previousOption = prerequisites.querySelector<HTMLOptionElement>('option[value="previous"]')
    const saveButton = rendered.$('#elce-summary-profile-settings-save') as HTMLButtonElement

    await rendered.act(() => {
      target.click()
      if (ignoreOption === null || previousOption === null) throw new Error('Les choix de prérequis sont absents.')
      ignoreOption.selected = false
      previousOption.selected = true
      prerequisites.dispatchEvent(new Event('change', { bubbles: true }))
      saveButton.click()
    })

    expect(controller.getSnapshot().context.document.data.profile.readingConstraints).toEqual([{
      id: expect.any(String),
      target: { kind: 'chapter', id: secondChapter.id },
      requirement: { kind: 'previous-chapter' },
    }])
    rendered.cleanup()
    controller.stop()
  })
})
