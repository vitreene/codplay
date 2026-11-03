/** Shared paragraph layout carried by the Section editor and Flux scene styles. */
export const DOT_LEADER_STYLE_SHEET = `
.elce-dot-leader-paragraph {
  display: flex;
  align-items: baseline;
  text-align: start;
}

.elce-dot-leader-content {
  display: contents;
}

.elce-dot-leader-text {
  flex: 0 1 auto;
  min-inline-size: 1ch;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.elce-dot-leader-text:first-child {
  order: 0;
}

.elce-dot-leader-text:last-child {
  order: 2;
  text-align: end;
}

.elce-dot-leader-rule {
  display: inline-block;
  order: 1;
  flex: 1 0 1em;
  block-size: 0;
  margin-inline: 0.3em;
  padding: 0;
  border-block-end: 1px dotted currentColor;
  vertical-align: baseline;
}
`
