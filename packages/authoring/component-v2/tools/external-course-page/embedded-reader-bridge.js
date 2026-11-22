(() => {
  const query = new URLSearchParams(window.location.search)
  const configText = query.get('config')
  const parentOrigin = query.get('parentOrigin')
  const sessionId = query.get('sessionId')
  const protocolVersion = 1
  const bootstrapDeadlineMs = 12_000
  const progressSampleIntervalMs = 100
  const startedAt = Date.now()
  let expectedConfig
  let expectedChapterId
  let expectedPageId
  let readySent = false
  let routeErrorSent = false
  let bootstrapTimer
  let pageReadyTimer
  let pageObserver
  let progressTimer
  let lastProgressKey
  let disposed = false

  try {
    expectedConfig = JSON.parse(configText ?? '')
  } catch {
    expectedConfig = undefined
  }
  expectedChapterId = typeof expectedConfig?.chapterParameter === 'string'
    ? expectedConfig.chapterParameter
    : undefined
  expectedPageId = typeof expectedConfig?.pageParameter === 'string'
    ? expectedConfig.pageParameter
    : undefined

  if (!isValidParentSession()) return
  window.addEventListener('message', handleParentMessage)
  window.addEventListener('hashchange', handleRouteChange)
  window.addEventListener('pagehide', dispose, { once: true })
  if (document.body !== null) {
    pageObserver = new MutationObserver(checkReaderReady)
    pageObserver.observe(document.body, { attributes: true, attributeFilter: ['data-page-id'] })
  }
  checkReaderReady()
  scheduleBootstrapCheck()

  /** Confirms the parent origin and session parameters before enabling the bridge. */
  function isValidParentSession() {
    if (parentOrigin === null || sessionId === null || sessionId.length === 0 || window.parent === window) return false
    try {
      const parsedOrigin = new URL(parentOrigin)
      return parsedOrigin.origin === parentOrigin
        && (parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:')
    } catch {
      return false
    }
  }

  /** Reads the source application's selected page and sends one readiness fact. */
  function checkReaderReady() {
    if (disposed || readySent) return
    const route = readRouteIdentity()
    if (route.chapterId !== expectedChapterId || route.pageId !== expectedPageId) return
    const application = window['shell']
    const lesson = application?.lesson
    const currentPageId = lesson?.currentPage?.id
    const bodyPageId = document.body?.dataset.pageId
    if (currentPageId !== expectedPageId || (bodyPageId !== undefined && bodyPageId !== expectedPageId)) return
    if (!hasNativePageTransport(lesson)) return
    if (pageReadyTimer !== undefined) return
    pageReadyTimer = window.setTimeout(() => {
      pageReadyTimer = undefined
      if (disposed || readySent) return
      const readyRoute = readRouteIdentity()
      const readyLesson = window['shell']?.lesson
      if (readyRoute.chapterId !== expectedChapterId
        || readyRoute.pageId !== expectedPageId
        || readyLesson?.currentPage?.id !== expectedPageId
        || document.body?.dataset.pageId !== expectedPageId
        || !hasNativePageTransport(readyLesson)) return
      readySent = true
      clearBootstrapCheck()
      postToParent({
        kind: 'ready',
        chapterId: readyRoute.chapterId,
        pageId: expectedPageId,
      })
      schedulePageProgress()
    }, 100)
  }

  /** Sends a bounded readiness check and reports a single bootstrap timeout. */
  function scheduleBootstrapCheck() {
    if (disposed || readySent || bootstrapTimer !== undefined) return
    bootstrapTimer = window.setTimeout(() => {
      bootstrapTimer = undefined
      if (disposed || readySent) return
      if (Date.now() - startedAt >= bootstrapDeadlineMs) {
        postToParent({
          kind: 'error',
          phase: 'bootstrap',
          reason: 'The expected page or native playback methods were not available before the bootstrap deadline.',
          chapterId: readRouteIdentity().chapterId,
          pageId: document.body?.dataset.pageId,
        })
        dispose()
        return
      }
      checkReaderReady()
      scheduleBootstrapCheck()
    }, 100)
  }

  /** Cancels the pending readiness timer after confirmation or teardown. */
  function clearBootstrapCheck() {
    if (bootstrapTimer === undefined) return
    window.clearTimeout(bootstrapTimer)
    bootstrapTimer = undefined
  }

  /** Validates and runs one Play/Pause command on the selected page object. */
  function handleParentMessage(event) {
    if (disposed || event.source !== window.parent || event.origin !== parentOrigin) return
    const message = event.data
    if (!isPlainRecord(message)
      || message.version !== protocolVersion
      || message.sessionId !== sessionId
      || message.kind !== 'command'
      || typeof message.requestId !== 'string'
      || (message.command !== 'play' && message.command !== 'pause' && message.command !== 'seek')
      || (message.command === 'seek' && !Number.isFinite(message.targetMs))) return

    const lesson = window['shell']?.lesson
    const identity = readRouteIdentity()
    if (identity.chapterId !== expectedChapterId
      || identity.pageId !== expectedPageId
      || lesson?.currentPage?.id !== expectedPageId) {
      postToParent({
        kind: 'error',
        phase: 'command',
        reason: 'The reader page changed before the playback command was applied.',
        chapterId: identity.chapterId,
        pageId: lesson?.currentPage?.id,
        requestId: message.requestId,
      })
      return
    }
    if (message.command === 'seek') {
      seekNativePageTimeline(lesson, message.requestId, message.targetMs)
      return
    }
    if (message.command === 'play') lesson.goResume()
    if (message.command === 'pause') lesson.goPause()
    schedulePageProgress()
    const status = lesson.paused === true ? 'paused' : 'playing'
    window.setTimeout(() => {
      if (disposed) return
      const currentSequence = lesson.currentSequency
      const sound = currentSequence?.soundInstance
      const sequenceId = currentSequence?.id
      postToParent({
        kind: 'result',
        requestId: message.requestId,
        status,
        sourceSequenceId: typeof sequenceId === 'string' ? sequenceId : null,
        sourceSoundAvailable: sound !== undefined && sound !== null,
        sourcePositionMs: Number.isFinite(sound?.position) ? sound.position : null,
        sourceDurationMs: Number.isFinite(sound?.duration) ? sound.duration : null,
      })
    }, 1_000)
  }

  /** Reports any route change that moves the embedded reader away from its page. */
  function handleRouteChange() {
    if (disposed || !readySent || routeErrorSent) return
    const route = readRouteIdentity()
    if (route.chapterId === expectedChapterId && route.pageId === expectedPageId) return
    routeErrorSent = true
    clearPageProgressTimer()
    postToParent({
      kind: 'error',
      phase: 'navigation',
      reason: 'The reader navigated away from the page assigned to this session.',
      chapterId: route.chapterId,
      pageId: route.pageId,
    })
  }

  /** Extracts chapter and page IDs from the reader's fragment route. */
  function readRouteIdentity() {
    const route = window.location.hash.match(/^#\/lesson\/([^/]+)\/([^/?]+)/)
    return {
      chapterId: decodeRoutePart(route?.[1]),
      pageId: decodeRoutePart(route?.[2]),
    }
  }

  /** Decodes one route segment without allowing a malformed route to escape. */
  function decodeRoutePart(value) {
    if (value === undefined) return undefined
    try {
      return decodeURIComponent(value)
    } catch {
      return undefined
    }
  }

  /** Checks the reader's page-level timeline and native slider callbacks. */
  function hasNativePageTransport(lesson) {
    const page = lesson?.currentPage
    const timeline = page?.pageTimeLine
    return typeof lesson?.goResume === 'function'
      && typeof lesson?.goPause === 'function'
      && page?.id === expectedPageId
      && timeline !== undefined
      && typeof timeline.time === 'function'
      && page.timeLineSlider !== undefined
      && typeof page.onSlideDown === 'function'
      && typeof page.onSlideUp === 'function'
      && Number.isFinite(page.totalDuration)
      && page.totalDuration > 0
  }

  /** Reads the source page timeline in milliseconds using its native duration. */
  function readNativePageProgress(lesson = window['shell']?.lesson) {
    if (!hasNativePageTransport(lesson)) return undefined
    const page = lesson.currentPage
    const timelineMs = Math.max(0, Math.round(page.pageTimeLine.time() * 1_000))
    const durationMs = Math.max(0, Math.round(page.totalDuration * 1_000))
    if (!Number.isFinite(timelineMs) || !Number.isFinite(durationMs) || durationMs <= 0) return undefined
    return {
      status: lesson.paused === true ? 'paused' : 'playing',
      timelineMs: Math.min(timelineMs, durationMs),
      durationMs,
    }
  }

  /** Publishes changed page progress outside the CodPlay event journal. */
  function publishPageProgress(force = false) {
    const progress = readNativePageProgress()
    if (progress === undefined) return
    const key = `${progress.status}:${progress.timelineMs}:${progress.durationMs}`
    if (!force && key === lastProgressKey) return
    lastProgressKey = key
    postToParent({ kind: 'progress', ...progress })
  }

  /** Samples the reader's timeline while this isolated page session is active. */
  function schedulePageProgress() {
    clearPageProgressTimer()
    if (disposed || !readySent) return
    publishPageProgress()
    progressTimer = window.setTimeout(schedulePageProgress, progressSampleIntervalMs)
  }

  /** Stops the timer that samples the reader-owned progress bar. */
  function clearPageProgressTimer() {
    if (progressTimer === undefined) return
    window.clearTimeout(progressTimer)
    progressTimer = undefined
  }

  /** Applies a seek through native callbacks and keeps the source paused like the host remote. */
  function seekNativePageTimeline(lesson, requestId, targetMs) {
    const page = lesson.currentPage
    const durationMs = page?.totalDuration * 1_000
    if (!hasNativePageTransport(lesson) || !Number.isFinite(durationMs) || durationMs <= 0) {
      postToParent({
        kind: 'seek-result',
        requestId,
        ok: false,
        reason: 'The reader page has no active page-level timeline slider.',
        status: lesson.paused === true ? 'paused' : 'playing',
        timelineMs: 0,
        durationMs: 0,
      })
      return
    }

    try {
      const boundedTargetMs = Math.max(0, Math.min(durationMs, targetMs))
      page.timeLineSlider.value = String(boundedTargetMs / durationMs * 100)
      page.onSlideDown()
      page.onSlideUp()
      lesson.goPause()
      const progress = readNativePageProgress(lesson)
      if (progress === undefined) throw new Error('The reader did not expose progress after seek.')
      postToParent({ kind: 'seek-result', requestId, ok: true, ...progress })
      schedulePageProgress()
    } catch (error) {
      const progress = readNativePageProgress(lesson)
      postToParent({
        kind: 'seek-result',
        requestId,
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        status: progress?.status ?? (lesson.paused === true ? 'paused' : 'playing'),
        timelineMs: progress?.timelineMs ?? 0,
        durationMs: progress?.durationMs ?? 0,
      })
    }
  }

  /** Posts one versioned message to the exact host origin supplied for this session. */
  function postToParent(message) {
    if (disposed || parentOrigin === null || sessionId === null) return
    window.parent.postMessage({ version: protocolVersion, sessionId, ...message }, parentOrigin)
  }

  /** Releases the sole readiness timer and DOM observer for this document. */
  function dispose() {
    if (disposed) return
    disposed = true
    clearBootstrapCheck()
    clearPageProgressTimer()
    lastProgressKey = undefined
    if (pageReadyTimer !== undefined) window.clearTimeout(pageReadyTimer)
    pageReadyTimer = undefined
    pageObserver?.disconnect()
    pageObserver = undefined
    window.removeEventListener('message', handleParentMessage)
    window.removeEventListener('hashchange', handleRouteChange)
  }

  /** Narrows one postMessage payload to a plain data object. */
  function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }
})()
