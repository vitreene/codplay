/** Player style rules owned by the context-independent List module. */
export const LIST_PLAYER_STYLE_RULES = [[160, `

.elce-list-module {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.elce-list-module {
  margin: 0;
  padding-inline-start: 1.25em;
}

.elce-list-module--none,
.elce-list-module--custom,
.elce-list-module--dash {
  list-style-type: none;
}

.elce-list-module--disc {
  list-style-type: disc;
}

.elce-list-module--square {
  list-style-type: square;
}

.elce-list-module--dash li::marker {
  content: '–  ';
}

.elce-list-module--custom li::marker {
  content: attr(data-marker) ' ';
}

.elce-list-module--decimal {
  list-style-type: decimal;
}

.elce-list-module--lower-alpha {
  list-style-type: lower-alpha;
}

.elce-list-module--lower-roman {
  list-style-type: lower-roman;
}

.elce-list-module li {
  min-width: 0;
  overflow-wrap: anywhere;
}
`]] as const
