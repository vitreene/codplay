declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(nodeAvatar: HTMLElement | null, options?: Record<string, unknown>)
    audioCtx: AudioContext
    animate(deltaMs: number): void
    showAvatar(config: Record<string, unknown>): Promise<void>
    setFixedValue(morphTarget: string, value: number | null): void
    setMood(mood: string): void
    stopSpeaking(): void
    start(): void
    stop(): void
  }
}
