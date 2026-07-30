# docs/projet/codplay-v2

Réflexions **projet** de `codplay` — les axes de travail (« où on veut aller, et pourquoi ») qui
précèdent le découpage en plans. La plupart de ces documents forment le **cahier des charges codplay V2**
(réécriture conceptuelle, cœur inclus).

**Organisation** : `notes/` accueille discussions, descriptions et recommandations. Le plan operatoire V2
est dans `packages/codplay-v2/plan/`.

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
- [`codplay-v2-plan.md`](../../../packages/codplay-v2/plan/codplay-v2-plan.md)
  — plan operatoire unique : architecture, inventaire V1 a reconstruire, dependances, jalons, demos V2,
  tests et questions ouvertes.
- [`2026-07-28-decoupage-engine-instances-pilotage.md`](../../../packages/codplay-v2/plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md)
  — note de cadrage de l'engine, des instances et du pilotage, deplacee dans le package.
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
- [`2026-07-29-noyau-solve-cadrage.md`](./notes/2026-07-29-noyau-solve-cadrage.md) — **cadrage avant
  écriture du noyau de calcul pur** (`solve`, courbes, composition de tweens), ce que la conduite §3
  déclare « valable » après avoir écarté la route « moteur injecté en V1 ». Six points arrêtés :
  **noyau V2 préparatoire**, **V1 strictement intouchée**
  (aucun point d'intégration), géométrie matricielle **écrite depuis zéro**, et `spatialCurve` + `blend`
  **dans le contrat dès la conception**. Conséquence énoncée : la signature `solve(from,to,ease,t)→valeur`
  esquissée par la conduite **ne tient plus** — ni une propriété, ni un tween à la fois. Frontière
  reconnue depuis le corpus : le noyau rend une **valeur native en unité d'auteur**, la **résolution
  d'unité ne lui appartient pas** (c'est `project`), et il n'y a **pas de pose composée à produire**
  (propriétés CSS discrètes). Oracle de parité = valeurs d'anime figées en fixtures.
  **Bloquant avant tout code** : forme d'une trajectoire déclarée et groupement des propriétés couplées.
- [`2026-07-29-projection-substrat-de-rendu.md`](./notes/2026-07-29-projection-substrat-de-rendu.md) —
  **Réserve de terme : « Projection » est retiré de cette désignation**, réservé au haut niveau pour la
  communication publique ; ce qui reste se dit en mots ordinaires (composant qui héberge, cible de rendu,
  substrat — mot de travail). Le terme demeure employé ailleurs dans le corpus, l'y reprendre est une
  décision distincte. **Le sujet est une extension, pas le cœur : codplay tourne sans.** Deux usages. (1)
  L'**espace désigné** dans une scène — usage **direct, déjà prototypé** (`threejs-anime-grid` : un `tag`
  sert d'espace, un perso `threejs` s'y monte, mais les paramètres sont enfouis dans les fonctions
  `build`/`simulate` et l'espace n'est qu'un `div` incident). Direction : **un composant grille paramétré
  comme tout perso, projeté dans un composant projection**. **Pas un concept neuf** : un layout héberge
  des persos, une projection aussi, et **`move` reste l'interface** — l'`outlet` est la face déclaration
  du perso, rien à étendre. Les **valeurs de placement** relatives à l'environnement hôte arrivent par le
  mécanisme existant : **un composant déclare ses capacités et un type TS auquel le perso est lié**. **Le
  sujet se dégonfle et se range comme un élément de scène ordinaire : rien de nouveau n'est demandé au
  moteur, seulement des composants** — le travail réel sur le prototype est du travail de composant. (2) Le **substrat de rendu** canvas — **v2.5/v3**, après certitude que
  la V2 fonctionne parfaitement ; consigné pour n'être pas réinstruit : usage = **effets de
  décor**, **sans gestion avancée des conflits de rendu avant une V3 au minimum**. Le DOM masque le
  problème général : ce qu'il apporte est un **arbre retenu**, pas une API de dessin, et c'est lui qui
  résout les conflits — mais l'usage V2 ne l'atteint pas. Pivot : **Skia n'est jamais la couche qu'une
  Projection adresse** — Flutter *est* déjà l'arbre retenu (RenderObjects), donc **la cible
  canvas-navigateur est le seul trou**, et le choix de bibliothèque n'engage pas le portage. Écartés
  faute d'arbre retenu : CanvasKit, OGL/regl, three.js ; inventaire Pixi/Konva/Two.js/Fabric consigné
  comme **besoin différé**. **Orientation : l'accès à WebGPU**, pour la complémentarité avec le DOM —
  et l'usage tranche pour l'**accès direct au shader** plutôt que pour l'abstraction retenue, qui
  n'aurait rien à porter. `html-to-canvas` natif **refermerait le trou** — à tester en démo (v2.5),
  état à vérifier. Structure : **toute bibliothèque tierce est potentiellement une projection** — three.js
  en **média** (ressource d'un seul perso, l'avatar) ou en **projection** (l'espace *est* le substrat,
  persos = caméra/cube/lumière). Ce qui les sépare n'est pas un degré de complexité mais **le sens de la
  possession de l'arbre** : en média la bibliothèque possède le sien, en projection codplay possède
  l'arbre et la bibliothèque le réalise. **Deux modèles, à disposer tous les deux**, à deux échelles de
  besoin. **Une Projection se place**, sous deux formes — **racine** (toute la scène) ou **hébergée** par
  un perso qui porte la surface, quatrième cas du **perso hôte** : c'est le lien entre les deux modèles,
  car une surface placée devient **adressable** (cibler une animation three.js vers elle). Placement =
  la boîte de l'hôte, par le layout ordinaire ; « toute la surface » et « une portion » sont deux
  dimensionnements du même hôte. **Plusieurs scènes partagent une Projection**, ce qui la range dans la
  famille de l'engine (invariant #4), pose `measure`/`mount` en espace commun — et entre en tension avec
  le placement hébergé (quel perso place une Projection partagée ?). **La greffe suit le modèle des bibliothèques
  tierces** — déclaration unique par factory, interdictions normatives intégrales, besoin **extrait par le
  Builder** donc chargé avant montage (« à la demande » ≠ « au dernier moment ») ; le composant signifie
  son besoin mais **la maîtrise reste à l'auteur** (identification ou chargement conditionnel, non
  départagés) ; le **DOM reste hors critère** en tant que défaut autonome (invariant #1). Réserve de nom :
  « Projection » est destiné à la communication publique avec un autre sens.
