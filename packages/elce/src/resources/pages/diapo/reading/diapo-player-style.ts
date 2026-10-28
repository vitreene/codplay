/** Player style rules owned by this reading resource. */
export const DIAPO_PLAYER_STYLE_RULES = [
  [42, `

.elce-diapo-host,
.elce-diapo-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`],
  [43, `

.elce-diapo-content {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}`],
  [44, `

.elce-diapo-content > .elce-card--carousel,
.elce-diapo-carousel-root {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  position: relative;
  overflow: hidden;
  container-type: inline-size;
  border: 0;
  border-radius: 0;
  background: transparent;
}`],
  [45, `

.elce-diapo-carousel-root > .elce-carousel__navigation {
  grid-row: 2;
  grid-column: 1;
}`],
  [46, `

.elce-diapo-content > .elce-card:not(.elce-card--carousel) {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}`],
  [47, `

.elce-diapo-content > .elce-card--question {
  display: flex;
  flex-direction: column;
}`],
  [48, `

.elce-diapo-content > .elce-card--question > .elce-question-illustration {
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  margin: 0;
  overflow: hidden;
}`],
  [49, `

.elce-diapo-content > .elce-card--question > form {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}`],
  [50, `

.elce-diapo-content > .elce-card--question > form > fieldset {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}`],
  [51, `

.elce-diapo-content > .elce-card--question .elce-question-answers {
  min-height: 0;
  flex: 1;
  align-content: start;
  overflow: hidden;
}`],
  [52, `

.elce-diapo-content .elce-carousel-capsule--scene,
.elce-diapo-content .elce-carousel-capsule__grid {
  height: 100%;
  min-height: 0;
}`],
  [105, `

.elce-diapo-question-media {
  display: block;
  width: 100%;
  max-height: 28vh;
  object-fit: contain;
}`],
  [106, `

.elce-diapo-question-media__native {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}`],
] as const
