export type HeadMotionValues = Readonly<{
  headX: number
  headY: number
  headTilt: number
}>

export type HeadMotionSample = Readonly<{
  startAtMs: number
  values: HeadMotionValues
}>

export type HeadMotionCaptureOptions = Readonly<{
  getTimeMs: () => number | null
  onFaceDetected: (detected: boolean) => void
  onMotion?: (values: HeadMotionValues) => void
  signal?: AbortSignal
}>

export type HeadMotionCaptureSession = Readonly<{
  stop: () => readonly HeadMotionSample[]
}>

type Point = Readonly<{ x: number; y: number }>
type FacePose = Readonly<{ x: number; y: number; tilt: number }>
type Landmarker = Readonly<{
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => Readonly<{
    faceLandmarks: readonly (readonly Point[])[]
  }>
  close: () => void
}>
type VisionModule = Readonly<{
  FilesetResolver: Readonly<{ forVisionTasks: (wasmRoot: string) => Promise<unknown> }>
  FaceLandmarker: Readonly<{
    createFromOptions: (
      fileset: unknown,
      options: Readonly<{
        baseOptions: Readonly<{ modelAssetPath: string; delegate: 'GPU' | 'CPU' }>
        runningMode: 'VIDEO'
        numFaces: 1
      }>,
    ) => Promise<Landmarker>
  }>
}>

const visionVersion = '1.0.1'
const visionPackageUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionVersion}/vision_bundle.mjs`
const visionWasmUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${visionVersion}/wasm`
const faceModelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const neutralHeadValues: HeadMotionValues = { headX: 50, headY: 50, headTilt: 50 }
const defaultTrackingSettings = { sensitivity: 1, smoothingPercent: 60, mirror: true, invertVertical: false }

/** Tracks a camera stream during audio capture and returns only timed head values. */
export async function startHeadMotionCapture(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: HeadMotionCaptureOptions,
): Promise<HeadMotionCaptureSession> {
  if (isCaptureAborted(options.signal)) throw new Error('Le suivi de tête a été interrompu.')
  if (stream.getVideoTracks().length === 0) throw new Error('Aucune piste vidéo caméra n’est disponible.')

  video.srcObject = stream
  video.muted = true
  video.playsInline = true

  let landmarker: Landmarker | null = null
  let frameRequest = 0
  let stopped = false
  let lastVideoTime = -1
  let wasFaceDetected: boolean | null = null
  let baseline: FacePose | null = null
  let smoothed = neutralHeadValues
  let lastRecordedValues: HeadMotionValues | null = null
  const samples = new Map<number, HeadMotionSample>()

  /** Releases the detector and detaches video without stopping the caller-owned tracks. */
  const stopTracking = (): void => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frameRequest)
    landmarker?.close()
    landmarker = null
    video.pause()
    video.srcObject = null
    if (wasFaceDetected === true) options.onFaceDetected(false)
  }

  options.signal?.addEventListener('abort', stopTracking, { once: true })
  try {
    await video.play()
    landmarker = await createLandmarker()
    if (isCaptureAborted(options.signal)) throw new Error('Le suivi de tête a été interrompu.')
  } catch (error) {
    landmarker?.close()
    landmarker = null
    stopTracking()
    options.signal?.removeEventListener('abort', stopTracking)
    throw error
  }

  if (landmarker === null) throw new Error('Le détecteur de visage n’a pas démarré.')
  const activeLandmarker = landmarker
  const processFrame = (timestampMs: number): void => {
    if (stopped) return
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      const landmarks = activeLandmarker.detectForVideo(video, timestampMs).faceLandmarks[0]
      const pose = landmarks === undefined ? null : readFacePose(landmarks)
      const faceDetected = pose !== null
      if (faceDetected !== wasFaceDetected) {
        wasFaceDetected = faceDetected
        options.onFaceDetected(faceDetected)
      }
      if (pose !== null) {
        if (baseline === null) baseline = pose
        const target = mapHeadPose(pose, baseline)
        const smoothing = defaultTrackingSettings.smoothingPercent / 100
        smoothed = {
          headX: smoothValue(smoothed.headX, target.headX, smoothing),
          headY: smoothValue(smoothed.headY, target.headY, smoothing),
          headTilt: smoothValue(smoothed.headTilt, target.headTilt, smoothing),
        }
        const position = {
          headX: roundOneDecimal(smoothed.headX),
          headY: roundOneDecimal(smoothed.headY),
          headTilt: roundOneDecimal(smoothed.headTilt),
        }
        options.onMotion?.(position)
        const timeMs = options.getTimeMs()
        const changed = lastRecordedValues === null || position.headX !== lastRecordedValues.headX
          || position.headY !== lastRecordedValues.headY || position.headTilt !== lastRecordedValues.headTilt
        if (changed && timeMs !== null && Number.isFinite(timeMs) && timeMs >= 0) {
          const startAtMs = Math.round(timeMs)
          samples.set(startAtMs, { startAtMs, values: position })
          lastRecordedValues = position
        }
      }
    }
    frameRequest = requestAnimationFrame(processFrame)
  }
  frameRequest = requestAnimationFrame(processFrame)

  return {
    stop: () => {
      stopTracking()
      options.signal?.removeEventListener('abort', stopTracking)
      return [...samples.values()].sort((first, second) => first.startAtMs - second.startAtMs)
    },
  }
}

/** Loads the same MediaPipe Tasks Vision runtime and face model used by AniMattor. */
async function createLandmarker(): Promise<Landmarker> {
  const vision = await import(visionPackageUrl) as VisionModule
  const fileset = await vision.FilesetResolver.forVisionTasks(visionWasmUrl)
  const options = {
    runningMode: 'VIDEO' as const,
    numFaces: 1 as const,
    baseOptions: { modelAssetPath: faceModelUrl, delegate: 'GPU' as const },
  }
  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, options)
  } catch {
    return vision.FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'CPU' },
    })
  }
}

/** Checks cancellation after asynchronous camera-model setup. */
function isCaptureAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

/** Extracts the face-relative nose position and eye-line angle from MediaPipe landmarks. */
function readFacePose(landmarks: readonly Point[]): FacePose | null {
  const leftCheek = landmarks[234]
  const rightCheek = landmarks[454]
  const forehead = landmarks[10]
  const chin = landmarks[152]
  const nose = landmarks[1]
  const leftEye = landmarks[33]
  const rightEye = landmarks[263]
  if (leftCheek === undefined || rightCheek === undefined || forehead === undefined || chin === undefined
    || nose === undefined || leftEye === undefined || rightEye === undefined) return null

  const faceWidth = Math.abs(rightCheek.x - leftCheek.x)
  const faceHeight = Math.abs(chin.y - forehead.y)
  if (faceWidth === 0 || faceHeight === 0) return null

  return {
    x: (nose.x - (leftCheek.x + rightCheek.x) / 2) / faceWidth,
    y: (nose.y - (forehead.y + chin.y) / 2) / faceHeight,
    tilt: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI,
  }
}

/** Maps a face pose relative to its first detected position into the rig's 0–100 values. */
function mapHeadPose(pose: FacePose, center: FacePose): HeadMotionValues {
  const mirror = defaultTrackingSettings.mirror ? -1 : 1
  const verticalDirection = defaultTrackingSettings.invertVertical ? 1 : -1
  return {
    headX: clampToRange(50 + (pose.x - center.x) * 100 * 4.2 * defaultTrackingSettings.sensitivity * mirror),
    headY: clampToRange(50 + (pose.y - center.y) * 100 * 5 * defaultTrackingSettings.sensitivity * verticalDirection),
    headTilt: clampToRange(50 + (pose.tilt - center.tilt) / 35 * 50 * defaultTrackingSettings.sensitivity * mirror),
  }
}

/** Smooths one target against the previous output using the demo's default factor. */
function smoothValue(previous: number, target: number, smoothing: number): number {
  return previous * smoothing + target * (1 - smoothing)
}

/** Clamps one output to the numeric range supported by the avatar rig. */
function clampToRange(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/** Rounds each internal head value to one decimal place before collecting it. */
function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}
