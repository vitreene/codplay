# Backlog lots

Lots apres la phase 1 (a ordonner lors de la prochaine revue):

- animation properties extensibility (pipeline agnostique sans allowlist) -> DONE (lot 05)
- wait flow complet (`startWait/resolveWait` runtime) -> DONE (lot 06)
- plugin list complet (`diff + FLIP + fallback perf`) -> DONE (lot 07)
- moteur FLIP generique (etude + implementation animejs) -> DONE (lot 08)
- trace/debug retention + export -> DONE (lot 09)
- conflits same-tick runtime (application effective des regles) -> DONE (lot 10)
- media sync avancee + master switching complet -> DONE (lot 11)
- convertisseur legacy outillage -> DONE (lot 12)
- createPlayer API + state runtime -> DONE (lot 13)
- telco locale (composant sur la meme page) -> DONE (lot 14)
- adaptation script animation Eddy (validation visuelle manuelle) -> DONE (lot 15)
- player playback timeline minimal (run manuel Eddy) -> DONE (lot 16)
- separation `move` en `policy/state/backend DOM` avec conservation stricte de la demo -> `../../formalisation/v1-move-separation-policy-state-backend-dom.md`
- telco websocket deportee (v2, exploration ulterieure)
- extraResources CSS (Blob `<style>`) jamais nettoye ni diffe sur `init()` repete — chaque rebuild ajoute un nouveau tag, meme a contenu identique, sans jamais retirer le precedent (constate depuis `packages/editor` : scene minimale, 4 rebuilds consecutifs -> 4 tags `<style>` accumules dans le head). Pas de defaut fonctionnel visible immediatement, mais accumulation reelle sur une session d'edition longue (dedit/sequence-editor rebuildent a chaque commit) — a corriger cote `Player.init()`/gestion des `extraResources`.
