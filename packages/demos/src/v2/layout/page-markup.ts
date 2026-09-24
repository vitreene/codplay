/** Shared markup for every V2 demo page. */
export const V2_DEMO_PAGE_MARKUP = `
  <main id="v2-demo-layout" class="v2-demo-layout" data-v2-demo-layout>
    <header id="v2-demo-header" class="v2-demo-header">
      <div id="v2-demo-header-copy" class="v2-demo-header__copy">
        <p id="v2-demo-eyebrow" class="v2-demo-eyebrow">CodPlay V2</p>
        <h1 id="v2-demo-title" class="v2-demo-title"></h1>
        <p id="v2-demo-description" class="v2-demo-description"></p>
      </div>
      <div id="v2-demo-header-tools" class="v2-demo-header__tools">
        <label id="v2-demo-selector-label" class="v2-demo-selector">
          <span id="v2-demo-selector-caption">Démo</span>
          <select id="v2-demo-selector" class="v2-demo-selector__input"></select>
        </label>
        <button id="v2-demo-logs-toggle" class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-logs-toggle" type="button" aria-expanded="false" aria-label="Afficher les logs" title="Afficher les logs">
          <svg id="v2-demo-logs-icon" class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 3h9l3 3v15H6V3zm2 2v14h8V7h-2V5H8zm2 5h4v1h-4zm0 3h4v1h-4zm0 3h4v1h-4z"></path>
          </svg>
          <span id="v2-demo-logs-label" class="v2-demo-button__label">Logs</span>
        </button>
      </div>
    </header>
    <section id="v2-demo-stage" class="v2-demo-stage" data-v2-demo-stage>
      <div id="v2-demo-scene" class="v2-demo-scene-slot" data-v2-demo-scene></div>
      <aside id="v2-demo-log-layer" class="v2-demo-log-layer" aria-live="polite">
        <div id="v2-demo-log-panel" class="v2-demo-log-panel" hidden>
          <div id="v2-demo-log-panel-header" class="v2-demo-log-panel__header">
            <span id="v2-demo-log-title">Journal</span>
            <div id="v2-demo-log-panel-actions" class="v2-demo-log-panel__actions">
              <button id="v2-demo-log-copy" class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-log-copy" type="button" aria-label="Copier le journal" title="Copier le journal">
                <svg id="v2-demo-log-copy-icon" class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 7V4h11v13h-3v3H5V7h3zm2 0h4v8h2V6h-6v1zm4 11v-1H8V9H7v9h7z"></path>
                </svg>
                <span id="v2-demo-log-copy-label" class="v2-demo-button__label">Copier</span>
              </button>
              <button id="v2-demo-log-close" class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-log-close" type="button" aria-label="Fermer le journal" title="Fermer le journal">
                <svg id="v2-demo-log-close-icon" class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4-1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4z"></path>
                </svg>
                <span id="v2-demo-log-close-label" class="v2-demo-button__label">Fermer</span>
              </button>
            </div>
          </div>
          <pre id="v2-demo-log-output" class="v2-demo-log-output"></pre>
        </div>
      </aside>
    </section>
    <footer id="v2-demo-footer" class="v2-demo-footer">
      <div id="v2-demo-telco" class="v2-demo-telco" data-v2-demo-telco></div>
    </footer>
  </main>
`;
