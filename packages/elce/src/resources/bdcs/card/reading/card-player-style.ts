/** Player style rules owned by this reading resource. */
export const CARD_PLAYER_STYLE_RULES = [
  [53, `

.elce-card--carousel {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.65rem;
}`],
  [63, `

.elce-card--text-short {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  text-align: center;
}`],
  [64, `

.elce-card--text-short > p,
.elce-card--text-short > footer {
  margin: 0;
}`],
  [66, `

.elce-card__meta {
  font-size: clamp(0.7rem, 1.5cqw, 0.95rem);
}`],
  [67, `

.elce-card--text-short .elce-card__title {
  font-size: max(1.7625rem, 4.935cqi);
  line-height: 1.2;
}`],
  [68, `

.elce-card__copy {
  font-size: max(0.9rem, 2.76cqi);
}`],
  [69, `

.elce-card--text-short .elce-card__message {
  line-height: 1.4;
}`],
  [70, `

.elce-card--text-image {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [75, `

.elce-card--text-image.elce-card--image-position-center {
  display: flex;
  flex-direction: column;
}`],
  [80, `

.elce-card--text-image .elce-card__title {
  font-size: max(1.551rem, 4.23cqi);
  line-height: 1.2;
}`],
  [81, `

.elce-card--text-image .elce-card__message {
  line-height: 1.35;
}`],
  [82, `

.elce-card--photo,
.elce-card--image-caption {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [87, `

.elce-card--image-caption {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}`],
  [88, `

.elce-card--image-caption > .elce-card-image-caption__image {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [89, `

.elce-card--image-caption > .elce-card__caption {
  margin: 0;
  font-size: 0.82rem;
}`],
  [90, `

.elce-card--image-title {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 12rem;
  place-items: center;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}`],
  [91, `

.elce-card--image-title > .elce-card__image {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
}`],
  [93, `

.elce-card--image-title > .elce-card__title {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: fit-content;
  max-inline-size: calc(100% - 2em);
  margin: 0;
  padding: 0.5em;
  color: var(--elce-appearance-surface-foreground);
  background-color: var(--elce-appearance-surface);
  background-color: color-mix(in oklch, var(--elce-appearance-surface) 82%, transparent);
  -webkit-backdrop-filter: blur(0.5rem);
  backdrop-filter: blur(0.5rem);
  font-size: max(1.5rem, 6cqi);
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  text-wrap: balance;
}`],
] as const
