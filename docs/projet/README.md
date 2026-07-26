# docs/projet

Réflexions **projet** de `codplay` — les axes de travail (« où on veut aller, et pourquoi »)
qui précèdent le découpage en plans, côté runtime `codplay`.

> **Note** : la plupart de ces documents forment le **cahier des charges codplay V2** (réécriture
> conceptuelle, cœur inclus). Une page ouvre un horizon distinct **au-dessus** de codplay (le
> méta-orchestrateur / framework) — marquée comme telle.

**Distinction avec les autres dossiers** :
- `docs/formalisation/` — specs normatives v1 (comportement figé, fait foi).
- `packages/*/plan/` — plans et specs **colocalisés** avec leur package.
- `docs/projet/` (ce dossier) — réflexions qui **précèdent** les plans : on y construit la
  direction avant qu'elle se décline en chantiers. Ce ne sont pas des specs ; ce sont les axes
  qui les justifient. Périmètre : `codplay`.

## Contenu

- [`2026-07-16-solve-project-moteur-custom.md`](./2026-07-16-solve-project-moteur-custom.md) —
  **le document V2 principal** : *quoi construire*. Résumé en 9 points-clés en tête, puis synthèse
  détaillée (S1-S9) : projection `item→perso→node` à sens unique ; solve/project ; moteur custom ;
  Projection (cible de rendu déclarée) ; `measure` irréductible ; flux `f(t)` ; portabilité. Suivi des
  chantiers historiques §0-§8 (surface réelle d'anime, doublons, séquencement) et de la discussion
  (pistes écartées). *Déplacé depuis `packages/codplay/plan/notes/` le 2026-07-26.*
- [`2026-07-26-etat-fonction-de-t.md`](./2026-07-26-etat-fonction-de-t.md) — **point constitutif V2**.
  L'état à `t` comme projection de la scène (modèle three.js), seek = évaluation réversible et non
  rejeu. Tout se lit par interrogation (continu → évaluation ; discret → fenêtre de validité ;
  capturé → valeur figée ; interaction → écrit dans la scène). Irréductible : effets à side-effect.
  C'est *moins* d'état qu'un store ; faisabilité = un inventaire, pas un pari. Inclut le comportement
  de piste au seek-back (propriété de piste `clear-ahead`/`persist` — debug d'atelier pour l'interaction
  d'édition, comportement conçu de l'œuvre pour l'interaction de diffusion).
- [`2026-07-26-conduite-chantier-v2.md`](./2026-07-26-conduite-chantier-v2.md) — **comment mener** la
  V2 (le doc principal dit *quoi*). Réécriture franche (V1 non-prod coupée à terme, pas de cohabitation
  de runtimes) ; tests V1 = oracle anti-régression ; « moteur injecté en V1 d'abord » écarté (retour
  d'expérience : couches parasites). Principes de structuration (dossiers dictés par le flux, injection
  unifiée, module/service natifs, dédoublements = concepts manquants, rien-en-dur/config). Frontière
  auteur/diffusion (l'œuvre reste pleinement interactive) ; façade multi-canaux (telco/injection/
  authoring) ; injection de librairies tierces à préserver.
- [`2026-07-26-portabilite-contrainte-redaction.md`](./2026-07-26-portabilite-contrainte-redaction.md)
  — le portage (cas concret Flutter) comme conséquence de la V2 : les obstacles au portage SONT les
  points V2 (Projection, f(t)/déclaratif, moteur custom). Surtout : la contrainte de portage
  **discipline le code TS présent** (interdit à l'écriture les fuites de plateforme). Chantier typage
  mûr (les `unknown` se dissipent, les cas d'usage les résolvent). Le seek V2 est synchrone (l'async
  est une dette V1 du rejeu, que f(t) solde).
- [`2026-07-26-unitless-resize-resolution.md`](./2026-07-26-unitless-resize-resolution.md) — détail
  du canal unitless (revue I/O #3) : cadre unitless fixe (ex. 160×90), ratio calculé au lancement,
  resize = le `scale` bouge (pas le ratio), valeurs unitless recalculées **hors scale** au render,
  whitelist déclarée en config, **couverture partielle assumée** (jamais 100%, échec propre). Résolu à
  la projection, capacité de Projection.
- [`2026-07-26-ancrages-algorithmiques.md`](./2026-07-26-ancrages-algorithmiques.md) — recul
  théorique : à quels modèles établis les processus V2 se rattachent. Event sourcing/CQRS (materialize/
  seek/f(t)), scene graph + dirty-flagging (solve hiérarchique/seek-FLIP), FRP Behavior/Event (typer le
  PersoState), retained-mode/reconciler (solve/project), interval tree + bitemporal (fenêtres de
  validité/seek-back), LOD temporel (scrubbing). Vocabulaire à emprunter, pas des frameworks.
- [`2026-07-26-meta-orchestrateur-preambule.md`](./2026-07-26-meta-orchestrateur-preambule.md) —
  **horizon distinct, au-dessus de codplay** (pas la V2). Préambule : la suite logique de codplay, un
  **framework** qui orchestre plusieurs scènes autonomes (ex. quiz-hunt appelant space-bubble comme
  épreuve). Le méta-orchestrateur est un *client* de codplay (pilote N players via la façade
  multi-canaux), pas une fonction du moteur. Trois niveaux distingués (widget-dans-scène / segment
  async / orchestration multi-scènes). À détailler ultérieurement.
- [`2026-07-26-seek-flip-ancetres-mobiles.md`](./2026-07-26-seek-flip-ancetres-mobiles.md) —
  cas limite : seek d'un FLIP sous parents/grands-parents en mouvement. La tension abstraction
  (fidèle au modèle) vs mesure DOM (fidèle au pixel réel : overflow/repaint/reflow non prédictibles).
  N mesures repositionnées dans un RAF (coupe par reflow, cache par segment, debounce), lourde mais
  acceptable en seek car non-continu. Non tranché.
