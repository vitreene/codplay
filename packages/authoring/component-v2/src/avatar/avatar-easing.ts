/** Samples TalkingHead's shared ease-in/ease-out transition curve. */
export function sampleTalkingHeadEasing(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  const base = (value: number) => 1 / (1 + Math.exp(-5 * value)) - 0.5
  const correction = 0.5 / base(1)
  return correction * base(2 * clamped - 1) + 0.5
}
