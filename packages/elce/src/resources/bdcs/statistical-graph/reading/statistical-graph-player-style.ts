/** Player style rules owned by the Statistical Graph reading resource. */
export const STATISTICAL_GRAPH_PLAYER_STYLE_RULES = [
  [157, `

.elce-statistical-graph__chart-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [158, `

.elce-statistical-graph__tick-label--rich,
.elce-statistical-graph__axis-label--rich {
  visibility: hidden;
}`],
  [159, `

.elce-statistical-graph__inline-label-overlay {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.elce-statistical-graph__inline-overlay-position {
  position: absolute;
  max-width: 32%;
  color: inherit;
  font-size: clamp(0.65rem, 1.2cqw, 0.75rem);
  line-height: 1.1;
  white-space: nowrap;
}

.elce-statistical-graph__inline-overlay-position a,
.elce-statistical-graph__inline-overlay-position button {
  pointer-events: auto;
}`],
] as const
