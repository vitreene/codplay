/** Player style rules owned by Learning's inline text labels. */
export const LEARNING_INLINE_TEXT_STYLE_RULES = [
  [155, `

.elce-inline-link--text {
  color: inherit;
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.15em;
  cursor: pointer;
}`],
  [156, `

.elce-inline-link--button {
  display: inline-block;
  margin-inline: 0.5em;
  padding: 0.15em 0.55em;
  border: 1px solid var(--elce-appearance-accent);
  border-radius: 0.35em;
  color: var(--elce-appearance-accent-foreground);
  background: var(--elce-appearance-accent);
  font: inherit;
  line-height: inherit;
  text-decoration: none;
  cursor: pointer;
}

.elce-inline-link--bold {
  font-weight: 700;
}

.elce-inline-link--italic {
  font-style: italic;
}

.elce-inline-link:focus-visible {
  outline: 2px solid var(--elce-appearance-accent);
  outline-offset: 2px;
}`],
] as const
