/** Exposes only the lifecycle operations used by native Remix editor views. */
export interface RemixRenderHandle {
  readonly signal: AbortSignal
  update(): Promise<unknown>
}
