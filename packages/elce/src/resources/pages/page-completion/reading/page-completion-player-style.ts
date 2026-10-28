/** Player style rules owned by this reading resource. */
export const PAGE_COMPLETION_PLAYER_STYLE_RULES = [
  [55, `

.elce-page-bottom-marker {
  display: block;
  width: 1px;
  height: 1px;
  margin-block-start: auto;
  opacity: 0;
}`],
  [56, `

.elce-carousel-completion-marker {
  position: absolute;
  inset-inline-end: 0;
  inset-block-end: 0;
  margin: 0;
  pointer-events: none;
}`],
  [62, `

.elce-carousel-view--hidden .elce-carousel-completion-marker {
  display: none;
}`],
] as const
