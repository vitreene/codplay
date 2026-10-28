/** Player style rules owned by this reading resource. */
export const QUESTION_PLAYER_STYLE_RULES = [
  [108, `

.elce-card--question {
  width: 100%;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.65rem;
}`],
  [109, `

.elce-card--question header h2 {
  font-size: max(1.551rem, 3.243cqi);
}`],
  [110, `

.elce-card--question .elce-question-illustration {
  width: min(100%, 32rem);
  margin: 0 auto 1rem;
}`],
  [111, `

.elce-card--question form,
.elce-card--question fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}`],
  [112, `

.elce-card--question legend {
  width: 100%;
  margin: 0 0 0.8rem;
  font-size: max(1.05rem, 2.76cqi);
  font-weight: 700;
  line-height: 1.4;
}`],
  [113, `

.elce-question-instructions {
  margin: 0 0 0.5rem;
  font-size: max(0.9rem, 2.76cqi);
}`],
  [114, `

.elce-card--question .elce-question-answers {
  display: grid;
  gap: 0.55rem;
}`],
  [115, `

.elce-card--question .input {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.5rem;
  background: var(--elce-appearance-surface);
}`],
  [116, `

.elce-question-validate {
  margin-top: 0.8rem;
  padding: 0.58rem 0.9rem;
  border: 0;
  border-radius: 0.45rem;
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
  font-weight: 700;
  cursor: pointer;
}`],
  [117, `

.elce-question-validate:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}`],
  [118, `

.elce-question-feedback {
  min-height: 1.5rem;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  line-height: 1.5;
}`],
  [119, `

.elce-question-feedback--correct {
  color: var(--elce-appearance-accent);
  font-weight: 700;
}`],
  [120, `

.elce-question-feedback--incorrect {
  color: var(--elce-appearance-accent-secondary);
  font-weight: 700;
}`],
] as const
