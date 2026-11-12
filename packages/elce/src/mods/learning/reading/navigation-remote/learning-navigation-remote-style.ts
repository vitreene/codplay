/** Styles the shared transport inside the existing page navigation bar. */
export const LEARNING_NAVIGATION_REMOTE_STYLE = `
.elce-player-navigation__center {
  grid-area: status;
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0.75rem;
}

.elce-player-navigation__center > .elce-player-navigation__status {
  flex: 0 0 auto;
  order: 1;
  white-space: nowrap;
}

.elce-player-navigation__remote {
  flex: 1;
  min-width: 0;
}

.elce-player-navigation__remote[hidden] {
  display: none;
}

.elce-player-navigation__remote .telco-remote__transport {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.elce-player-navigation__remote .telco-button {
  display: inline-grid;
  flex: 0 0 2.5rem;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--elce-appearance-border);
  border-radius: 0.45rem;
  color: var(--elce-appearance-surface-foreground);
  background: var(--elce-appearance-surface);
  cursor: pointer;
}

.elce-player-navigation__remote .telco-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.elce-player-navigation__remote .telco-button__icon {
  display: block;
  height: 1cap;
  width: auto;
  fill: currentColor;
}

.elce-player-navigation__remote .telco-button__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.elce-player-navigation__remote .telco-remote__seek {
  display: flex;
  flex: 1;
  min-width: 0;
}

.elce-player-navigation__remote input[type='range'] {
  width: 100%;
  min-width: 0;
  accent-color: var(--elce-appearance-accent);
}

.elce-player-navigation__remote .telco-remote__seek > span,
.elce-player-navigation__remote .telco-remote__seek > output,
.elce-player-navigation__remote .telco-remote__rates,
.elce-player-navigation__remote .telco-remote__state {
  display: none;
}

@media (max-width: 800px) {
  .elce-player-navigation:has(.elce-player-navigation__remote:not([hidden])) {
    grid-template-areas: 'previous status next' 'remote remote remote';
  }

  .elce-player-navigation__center:has(.elce-player-navigation__remote:not([hidden])) {
    display: contents;
  }

  .elce-player-navigation__remote:not([hidden]) {
    grid-area: remote;
  }

  .elce-player-navigation--with-summary[data-summary-button-visible='true']:has(.elce-player-navigation__remote:not([hidden])) {
    grid-template-areas: 'previous summary status next' 'remote remote remote remote';
  }
}
`
