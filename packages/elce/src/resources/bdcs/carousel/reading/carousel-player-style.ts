/** Player style rules owned by this reading resource. */
export const CAROUSEL_PLAYER_STYLE_RULES = [
  [57, `

.elce-carousel-capsule {
  position: relative;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  container-type: inline-size;
}`],
  [58, `

.elce-carousel-capsule__grid {
  position: relative;
}`],
  [59, `

.elce-carousel-view {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [60, `

.elce-carousel-view--visible {
  opacity: 1;
  pointer-events: auto;
}`],
  [61, `

.elce-carousel-view--hidden {
  opacity: 0;
  pointer-events: none;
}`],
  [65, `

/* Flex-item margins do not collapse, so the heading supplies this one gap. */
.elce-card--text-short > .elce-card__overline:has(+ .elce-card__title),
.elce-card--text-image > .elce-carousel-text-image__content > .elce-card__overline:has(+ .elce-card__title) {
  margin-block-end: 0;
}`],
  [71, `

.elce-card--text-image > .elce-carousel-text-image__content {
  box-sizing: border-box;
  display: flex;
  width: 60%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  margin-inline-start: 40%;
  overflow: hidden;
}`],
  [72, `

.elce-card--text-image > .elce-carousel-text-image__content > .elce-carousel-text-image__image {
  position: absolute;
  z-index: 1;
  inset-block: 0;
  inset-inline-start: 0;
  width: 40%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [73, `

.elce-card--text-image.elce-card--image-position-right > .elce-carousel-text-image__content {
  margin-inline: 0 40%;
}`],
  [74, `

.elce-card--text-image.elce-card--image-position-right > .elce-carousel-text-image__content > .elce-carousel-text-image__image {
  inset-inline: auto 0;
}`],
  [76, `

.elce-card--text-image.elce-card--image-position-center > .elce-carousel-text-image__content {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
}`],
  [77, `

.elce-card--text-image.elce-card--image-position-center > .elce-carousel-text-image__content > .elce-carousel-text-image__image {
  position: static;
  z-index: auto;
  display: flex;
  width: 100%;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
}`],
  [78, `

.elce-card--text-image.elce-card--image-position-center > .elce-carousel-text-image__content > :not(.elce-carousel-text-image__image) {
  text-align: center;
}`],
  [79, `

.elce-card--text-image > .elce-carousel-text-image__content > p,
.elce-card--text-image > .elce-carousel-text-image__content > footer {
  margin: 0;
}`],
  [83, `

.elce-card--photo > .elce-carousel-photo__media,
.elce-carousel-view.elce-card--photo.elce-carousel-photo__media {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}`],
  [84, `

.elce-carousel-media {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}`],
  [85, `

.elce-carousel-media > img,
.elce-carousel-media > video {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}`],
  [86, `

.elce-carousel-media--contain > img {
  object-fit: contain;
}`],
  [92, `

.elce-card--image-title > .elce-card__image > .elce-carousel-media {
  width: 100%;
  height: 100%;
}`],
  [94, `

.elce-carousel__navigation {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.35rem;
}`],
  [95, `

.elce-carousel-dot {
  display: inline-grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 50%;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  line-height: 1;
}`],
  [96, `

.elce-carousel-dot--active {
  border-color: var(--elce-appearance-accent);
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
}`],
  [97, `

.elce-carousel-dot:not(:disabled) {
  cursor: pointer;
}`],
  [98, `

.elce-carousel-dot:disabled {
  opacity: 0.75;
}`],
  [104, `

.elce-carousel-photo__media > .elce-carousel-media-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}`],
] as const
