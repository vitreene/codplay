import type { StrapExecutionInput } from 'codplay/runtime/player'
import { TRACK_EVENT_DEACTIVATE } from 'codplay/runtime/player'
import { describe, expect, it } from 'vitest'
import { ELCE_EVENTS } from '../reading/learning-reading-events'
import type { ProfileProperty } from '../profile/domain/learning-profile-types'
import {
  ELCE_CAROUSEL_RUNTIME_KEY,
  selectCarouselCardStrap,
} from '../../../builders/scene-functions/carousel'
import {
  changeProfileValueStrap,
  ELCE_PROFILE_FORM_RUNTIME_KEY,
  submitProfileStrap,
} from '../../../builders/scene-functions/profile-form'
import {
  ELCE_QUESTION_RUNTIME_KEY,
  resetQuestionStrap,
  selectQuestionAnswerStrap,
  validateQuestionAnswerStrap,
} from '../../../resources/bdcs/question/reading/question-runtime'
import {
  ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY,
  initializeViewportGestureCapture,
  trackViewportGesture,
  viewportExpansionStrap,
} from '../../../builders/scene-functions/viewport-expansion'

describe('Elcé grouped scene callbacks', () => {
  it('selects, validates, and resets a Question using only state and event inputs', () => {
    const questionState = {
      selectedAnswerIds: ['answer-correct'],
      submitted: false,
      [ELCE_QUESTION_RUNTIME_KEY]: {
        pageId: 'page-fixture',
        bdcId: 'question-fixture',
        prefix: 'page-fixture:question-fixture',
        questionType: 'multiple-choice',
        title: 'Question fixture',
        prompt: 'Choisissez une réponse.',
        answerIds: ['answer-correct', 'answer-other'],
        answerLabels: ['Correcte', 'Autre'],
        correctAnswerIds: ['answer-correct'],
        selection: 'multiple',
        completionEventName: ELCE_EVENTS.PAGE_FINISHED,
        completionEventData: { pageId: 'page-fixture' },
      },
    }

    expect(selectQuestionAnswerStrap(makeInput('select', 'select', { answerId: 'answer-other' }, questionState))).toMatchObject({
      update: { selectedAnswerIds: ['answer-correct', 'answer-other'] },
      events: [
        { name: 'page-fixture:question-fixture:selection:available' },
        { name: 'page-fixture:question-fixture:answer:answer-correct:selected' },
        { name: 'page-fixture:question-fixture:answer:answer-other:selected' },
      ],
    })
    const validated = validateQuestionAnswerStrap(makeInput('validate', 'validate', undefined, questionState))
    expect(validated?.update).toEqual({ selectedAnswerIds: ['answer-correct'], submitted: true })
    expect(validated?.events).toEqual(expect.arrayContaining([
      {
        name: ELCE_EVENTS.QUESTION_ANSWERED,
        data: expect.objectContaining({ description: 'Question fixture Choisissez une réponse.' }),
        visibility: 'public',
      },
      { name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: 'page-fixture' }, visibility: 'public' },
    ]))
    expect(resetQuestionStrap(makeInput('reset', ELCE_EVENTS.QUESTION_RESET, undefined, questionState))).toMatchObject({
      update: { selectedAnswerIds: [], submitted: false },
      events: expect.arrayContaining([{ name: 'page-fixture:question-fixture:feedback', data: { content: '', attr: { hidden: true } } }]),
    })
  })

  it('updates and validates profile values from compiled form parameters', () => {
    const properties: readonly ProfileProperty[] = [{
      id: 'profile-fixture',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: true,
      choices: [],
    }]
    const state = {
      values: {},
      [ELCE_PROFILE_FORM_RUNTIME_KEY]: {
        prefix: 'fixture:profile',
        properties,
        fieldPropertyIds: ['profile-fixture'],
      },
    }

    const changed = changeProfileValueStrap(makeInput('change', 'change', {
      propertyId: 'profile-fixture',
      value: 'reader',
    }, state))
    expect(changed).toMatchObject({
      update: { values: { 'profile-fixture': 'reader' } },
      events: [{ name: ELCE_EVENTS.PROFILE_CHANGED, data: { profileValues: { 'profile-fixture': 'reader' } }, visibility: 'public' }],
    })
    expect(submitProfileStrap(makeInput('submit', 'submit', undefined, {
      ...state,
      values: { 'profile-fixture': 'reader' },
    }))).toMatchObject({
      events: expect.arrayContaining([
        { name: ELCE_EVENTS.PROFILE_SUBMIT, data: { profileValues: { 'profile-fixture': 'reader' } }, visibility: 'public' },
      ]),
    })
    expect(submitProfileStrap(makeInput('submit', 'submit', undefined, state))).toMatchObject({
      events: [{ name: ELCE_EVENTS.PROFILE_ERROR, visibility: 'story' }],
    })
  })

  it('selects a Carousel view and deactivates its automatic track through passed parameters', () => {
    expect(selectCarouselCardStrap(makeInput('select', 'select-card', { cardBdcId: 'card-b' }, {
      activeCardBdcId: 'card-a',
      manualCarouselSelection: false,
      [ELCE_CAROUSEL_RUNTIME_KEY]: {
        prefix: 'page:carousel',
        storyId: 'page-carousel',
        cardIds: ['card-a', 'card-b'],
        selectionEvent: 'page:carousel:select-card',
        automatic: true,
        trackId: 'page-carousel',
        trackDeactivateEvent: TRACK_EVENT_DEACTIVATE,
        views: [],
      },
    }))).toMatchObject({
      update: { activeCardBdcId: 'card-b', manualCarouselSelection: true },
      events: expect.arrayContaining([
        { name: 'page:carousel:card:card-a:unselected' },
        { name: 'page:carousel:card:card-b:selected' },
        { name: TRACK_EVENT_DEACTIVATE, data: { trackIds: ['page-carousel'] }, visibility: 'scene' },
      ]),
    })
  })

  it('opens viewport content and accumulates pointer movement with top-level capture callbacks', () => {
    const config = {
      storyId: 'story-fixture',
      hostId: 'story-fixture-viewport-expansion-host',
      contentIds: ['image-fixture'],
      views: [{ bdcId: 'card-fixture', persoId: 'image-fixture' }],
      carousel: {
        selectionEvent: 'story-fixture:carousel:select',
        automatic: false,
        trackId: 'story-fixture',
        trackActivateEvent: 'track:activate',
        trackDeactivateEvent: 'track:deactivate',
      },
      gestureEndEvent: 'story-fixture:viewport-expansion:gesture-ended',
      keyboardToggleEvent: 'story-fixture:viewport-expansion:keyboard-toggle',
      escapeEvent: 'story-fixture:viewport-expansion:escape',
      openHostEvent: 'story-fixture:viewport-expansion:open-host',
      closeHostEvent: 'story-fixture:viewport-expansion:close-host',
      finishCloseHostEvent: 'story-fixture:viewport-expansion:finish-close-host',
      focusReadyEvent: 'story-fixture:viewport-expansion:focus-ready',
    }
    const result = viewportExpansionStrap(makeInput(
      'viewport',
      config.gestureEndEvent,
      { sourceId: 'image-fixture', captureState: { deltaX: 1, deltaY: 0 } },
      { [ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY]: config },
    ))

    expect(initializeViewportGestureCapture()).toEqual({ deltaX: 0, deltaY: 0 })
    expect(trackViewportGesture({ sample: { movementX: -10, movementY: 2 }, captureState: { deltaX: 4, deltaY: 1 } }))
      .toEqual({ captureState: { deltaX: -6, deltaY: 3 } })
    expect(result).toMatchObject({
      update: { expandedContentId: 'image-fixture', closingContentId: null, activeCardBdcId: 'card-fixture' },
      events: expect.arrayContaining([
        { name: 'story-fixture:viewport:content:image-fixture:open', visibility: 'story' },
        { name: 'story-fixture:viewport-expansion:open-host', visibility: 'story' },
        { name: 'elce:viewport-expansion:request-scroll-lock', visibility: 'scene' },
        { name: 'story-fixture:viewport:carousel:card-fixture:current', visibility: 'story' },
      ]),
    })
  })
})

/** Builds the immutable runtime values supplied to one grouped scene callback. */
function makeInput(
  strapName: string,
  eventName: string,
  eventData: Readonly<Record<string, unknown>> | undefined,
  state: Readonly<Record<string, unknown>>,
): StrapExecutionInput {
  return {
    strapName,
    event: { name: eventName, ...(eventData === undefined ? {} : { data: eventData }) },
    state,
    meta: {},
    context: { planned: {} },
  } as unknown as StrapExecutionInput
}
