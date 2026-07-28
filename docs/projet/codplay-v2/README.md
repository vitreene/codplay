# docs/projet/codplay-v2

Réflexions **projet** de `codplay` — les axes de travail (« où on veut aller, et pourquoi ») qui
précèdent le découpage en plans. La plupart de ces documents forment le **cahier des charges codplay V2**
(réécriture conceptuelle, cœur inclus).

**Organisation** : `notes/` accueille discussions, descriptions et recommandations. Les parties **spec**
et **plan** ne sont pas ouvertes.

**Distinction avec les autres dossiers** :
- `docs/formalisation/` — specs normatives v1 (comportement figé, fait foi).
- `packages/*/plan/` — plans et specs **colocalisés** avec leur package.
- `docs/projet/sighty/` — l'orchestrateur, horizon distinct **au-dessus** de codplay.

## notes/

- [`2026-07-28-carte-projet-v2.md`](./notes/2026-07-28-carte-projet-v2.md) — **carte de navigation du
  projet V2**, à lire en premier quand le corpus fait perdre de vue qu'il s'agit d'une **mise à jour**. En
  tête, l'**articulation** en deux lignes indépendantes qui se rejoignent au player — `SceneDoc` →[builder]→
  `CompiledScene` d'un côté, engine de l'autre (il *fournit* le player, il ne lit pas la scène : c'est la
  **scène qui déclare ses besoins**) — puis render. Ensuite un classement par domaine fonctionnel :
  **conservé** (le concept ne change pas, le code est réécrit : track manager, média/horloge, injection
  tierce, contrat module/service, effets à side-effect…), **revu** (flux solve/project, moteur custom,
  Projection, seek comme évaluation, capture, façade, catalogue, preload, portée d'un event, propriété de
  la boucle, lecture arrière…), **à statuer** (silence du corpus : layout, horizon, runtime policy,
  helpers…) et **hors V2**. Ne développe rien : classe et cite. Les lignes « conservé » sont des déductions
  du corpus à confirmer par l'auteur. Une section de renvoi indique où lire la **matrice des intentions**
  et les **dissonances**, amendées là où elles avaient été relevées.
- [`2026-07-16-solve-project-moteur-custom.md`](./notes/2026-07-16-solve-project-moteur-custom.md) —
  **le document V2 principal** : *quoi construire*. Résumé en 9 points-clés en tête, puis synthèse
  détaillée (S1-S9) : projection `item→perso→node` à sens unique ; solve/project ; moteur custom ;
  Projection (cible de rendu déclarée) ; `measure` irréductible ; flux `f(t)` ; portabilité. Suivi des
  chantiers historiques §0-§8 (surface réelle d'anime, doublons, séquencement) et de la discussion
  (pistes écartées). *Déplacé depuis `packages/codplay/plan/notes/` le 2026-07-26.*
- [`2026-07-26-etat-fonction-de-t.md`](./notes/2026-07-26-etat-fonction-de-t.md) — **point constitutif V2**.
  L'état à `t` comme projection de la scène (modèle three.js), seek = évaluation réversible et non
  rejeu. Tout se lit par interrogation (continu → évaluation ; discret → fenêtre de validité ;
  capturé → valeur figée ; interaction → écrit dans la scène). Irréductible : effets à side-effect.
  C'est *moins* d'état qu'un store ; faisabilité = un inventaire, pas un pari. Inclut le comportement
  de piste au seek-back (propriété de piste `clear-ahead`/`persist` — debug d'atelier pour l'interaction
  d'édition, comportement conçu de l'œuvre pour l'interaction de diffusion).
- [`2026-07-26-conduite-chantier-v2.md`](./notes/2026-07-26-conduite-chantier-v2.md) — **comment mener** la
  V2 (le doc principal dit *quoi*). Réécriture franche (V1 non-prod coupée à terme, pas de cohabitation
  de runtimes) ; tests V1 = oracle anti-régression ; « moteur injecté en V1 d'abord » écarté (retour
  d'expérience : couches parasites). Principes de structuration (dossiers dictés par le flux, injection
  unifiée, module/service natifs, dédoublements = concepts manquants, rien-en-dur/config). Frontière
  auteur/diffusion (l'œuvre reste pleinement interactive) ; façade multi-canaux (telco/injection/
  authoring) ; injection de librairies tierces à préserver. **§11 — la matrice des intentions** : huit
  invariants directeurs (le défaut autonome qui s'efface devant l'étage supérieur ; déclarer jamais
  inférer ; un canal par responsabilité ; catalogue / revendication / arrangement ; l'exécutant ne décide
  pas ; le ciblage un étage au-dessus ; un seul écrivain ; sanitiser une fois puis faire confiance), à
  **force obligatoire** — un risque de contournement déclenche une analyse, jamais un contournement
  silencieux ; et un invariant non écrit n'est qu'une habitude, qui se perd à la réécriture.
- [`2026-07-28-decoupage-engine-instances-pilotage.md`](./notes/2026-07-28-decoupage-engine-instances-pilotage.md)
  — **axe V2** : instruit l'exigence que le préambule méta-orchestrateur pose sur codplay (« être
  orchestrable proprement »). Trois étages (**engine** / factory de `CompiledScene` / **instance**) ;
  l'engine porte le catalogue de capacités et les ressources partagées (horloge, cache preload, styles),
  jamais la racine de mesure ; une **même posture revient trois fois** — horloge délégable, catalogue
  déclaré au-dessus, stratégie de preload cédée à qui sait à l'avance : codplay fournit un défaut autonome
  et s'efface devant l'étage supérieur. Modules **déclarés par l'engine, instanciés par chaque player**.
  Pilotage : **events comme contrat primaire** (authoring hors protocole ; « ce qui traverse pourrait
  traverser un worker ») ; **multi-scénario** comme capacité émergente à nommer (multi-langue) ; **portée
  d'un event** du booléen à une échelle nommée, avec la règle d'admission d'une phase (seules les
  transitions émettent — `onError` et `onUpdate` écartés) ; fins narrative et technique ramenées au
  vocabulaire normatif. **Mode hôte** : une instance jouée dans une autre, même *perso hôte* que le flux
  direct ; ordre de tick « hôte avant hébergé » ; une transition ne dédouble jamais une instance vivante.
  **Seek à instances multiples** : seek atomique sur un ensemble, cible par membre, disponibilité par
  portée. Recense **9 dispositifs V1 à ne pas reprendre** et les points ouverts, dont **`context.live` face
  à `f(t)`** et son remplacement par `TweenAction`.
- [`2026-07-26-portabilite-contrainte-redaction.md`](./notes/2026-07-26-portabilite-contrainte-redaction.md)
  — le portage (cas concret Flutter) comme conséquence de la V2 : les obstacles au portage SONT les
  points V2 (Projection, f(t)/déclaratif, moteur custom). Surtout : la contrainte de portage
  **discipline le code TS présent** (interdit à l'écriture les fuites de plateforme). Chantier typage
  mûr (les `unknown` se dissipent, les cas d'usage les résolvent). Le seek V2 est synchrone (l'async
  est une dette V1 du rejeu, que f(t) solde).
- [`2026-07-26-unitless-resize-resolution.md`](./notes/2026-07-26-unitless-resize-resolution.md) — détail
  du canal unitless (revue I/O #3) : cadre unitless fixe (ex. 160×90), ratio calculé au lancement,
  resize = le `scale` bouge (pas le ratio), valeurs unitless recalculées **hors scale** au render,
  whitelist déclarée en config, **couverture partielle assumée** (jamais 100%, échec propre). Résolu à
  la projection, capacité de Projection.
- [`2026-07-26-ancrages-algorithmiques.md`](./notes/2026-07-26-ancrages-algorithmiques.md) — recul
  théorique : à quels modèles établis les processus V2 se rattachent. Event sourcing/CQRS (materialize/
  seek/f(t)), scene graph + dirty-flagging (solve hiérarchique/seek-FLIP), FRP Behavior/Event (typer le
  PersoState), retained-mode/reconciler (solve/project), interval tree + bitemporal (fenêtres de
  validité/seek-back), LOD temporel (scrubbing). Vocabulaire à emprunter, pas des frameworks.
- [`2026-07-26-seek-flip-ancetres-mobiles.md`](./notes/2026-07-26-seek-flip-ancetres-mobiles.md) —
  cas limite : seek d'un FLIP sous parents/grands-parents en mouvement. La tension abstraction
  (fidèle au modèle) vs mesure DOM (fidèle au pixel réel : overflow/repaint/reflow non prédictibles).
  N mesures repositionnées dans un RAF (coupe par reflow, cache par segment, debounce), lourde mais
  acceptable en seek car non-continu. Non tranché.
- [`2026-07-27-emetteurs-et-events-user-complexes.md`](./notes/2026-07-27-emetteurs-et-events-user-complexes.md)
  — accueillir des events utilisateur **complexes** (gestes filmés, capteurs, reconnaissance amont)
  sans jamais ouvrir de canal d'events continu. Le manque : un canal d'events qui ne sait pas
  observer (`emit`), un canal d'observation qui ne sait pas émettre (`trackCommand`). Réduction vers
  l'**intention**, rendue structurelle par l'émission **sur transition d'une phase déclarée**
  (`endEmit` libéré de `endOn`). L'**émetteur** = capacité déclarée comme un composant, porteur qui
  manquait à la règle 9 (appartenance) et séparant ressource permanente / fenêtre bornée ; le
  reconnaisseur est un module, le déclencheur d'`emit` cesse d'être supposé natif. Capacité requise
  pour *jouer*, jamais pour *rejouer*. Écarté : « stream » comme concept frère, throttle runtime,
  émission périodique. Non tranché : indisponibilité à l'exécution (classe d'échec inédite),
  scène vs story, nom. **Complément §6** (sujet distinct) : le **flux direct** (webcam, TV) —
  toujours à `now`, jamais à `t`, second membre des *irréductibles* ; seul l'**hôte** suit les
  conditions ordinaires d'un perso, le contenu n'est jamais matérialisé. Seek continue de diffuser,
  `rate` ignoré, pas de tampon. La non-relecture se **déclare** (le pilotage `currentTime` du composant
  media combattrait un direct). Annexe : Q/R de la discussion fondatrice.
