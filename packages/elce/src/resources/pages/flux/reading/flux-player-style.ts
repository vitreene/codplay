/** Player style rules owned by this reading resource. */
export const FLUX_PLAYER_STYLE_RULES = [
  [39, `

.elce-flux-scrollport {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
}`],
  [40, `

.elce-flux-article {
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  box-sizing: border-box;
}`],
  [41, `

.elce-flux-article > section {
  width: 100%;
  flex: 0 0 auto;
  position: relative;
}`],
  [54, `

.page-flux .question:not(.has-background),
.page-flux .carousel {
  padding: clamp(1rem, 3vw, 1.6rem);
}`],
  [99, `

.elce-flux-image {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  position: relative;
  overflow: hidden;
  object-fit: contain;
}`],
  [100, `

.elce-flux-image > img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: contain;
}`],
  [101, `

.elce-flux-image .elce-flux-image__native {
  display: block;
  width: 100%;
  height: 100%;
  max-height: none;
  object-fit: contain;
}`],
  [102, `

.elce-flux-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}`],
  [103, `

.elce-flux-video:not(.elce-flux-video--anchored) {
  position: relative;
  max-width: 48rem;
  margin-inline: auto;
}`],
  [107, `

.elce-flux-card-root {
  width: 100%;
}`],
  [121, `

.elce-flux-article > section p,
.elce-flux-article > section h1,
.elce-flux-article > section h2,
.elce-flux-article > section h3,
.elce-flux-article > section h4,
.elce-flux-article > section h5,
.elce-flux-article > section h6 {
  position: relative;
}`],
] as const
