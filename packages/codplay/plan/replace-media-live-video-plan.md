# Plan `replace` — play(t) = seek(t), médias H-i-C et portage slot

> Statut : En cours. Plan validé et implémentation du cœur autorisée par
> l’utilisateur. Tranche A faite et vérifiée (tests, contrôle navigateur H-i-C
> par l’utilisateur), reportée dans les specs. B2 fait. Restent l’alignement
> `burn` (B), B1 et la tranche C.

Specs propriétaires : [présentation replace](../specs/replace-presentation-v2-spec.md),
[média](../specs/replace-media-v2-spec.md), [presets](../specs/replace-presets-v2-spec.md),
[texte](../specs/replace-text-v2-spec.md), [slot](../specs/slot-component-spec.md).
Constats et mesures : [diagnostic, module `replace`](./2026-11-25-diagnostic-codplay.md#module-replace--revue-détaillée)
(RP1 à RP5).

## Ordre

1. Tranche A, mécanisme commun : préalable à toute acceptation Seek de B et C.
   Priorité A1 puis A2 : les sessions rejouées par un Seek créent un contexte
   GPU par `burn` passé, et des erreurs console sur les contextes ont été
   observées. A3 et A4 suivent.
2. Tranche B, médias : fermer l’alignement en cours, puis les optimisations.
3. Tranche C, portage de `burn` sur le slot, après A2.
4. Tranche D, effets du site de référence, après C (le renderer H-i-C commun
   sert aux médias et au slot).

## Décisions fixées

- **Repli H-i-C.** Toute transition H-i-C déclare un repli vers une transition
  déjà implémentée, choisi avant toute création de snapshot quand les
  primitives H-i-C, WebGL2 ou le shader manquent. Le repli de `burn` est le
  `mask-reveal` circulaire (`createBurnFallbackProfile`, `session.ts`), pour les
  médias comme pour le slot. Le repli ne change ni la durée ni l’état logique.
- Le nœud vidéo persistant reste possédé et lu par `media-sync`. Pendant un
  remplacement entier hors H-i-C, son snapshot entrant reprend sa frame
  courante à chaque échantillon player ; le snapshot sortant reste fixe. Aucun
  lecteur n’est créé.
- `burn` suit le modèle H-i-C du [site de référence](https://html-in-canvas.page/transitions/) : wrappers `drawable`
  contenant des slots d’état, et textures DOM mises à jour sur `paint`. Les
  médias natifs restent enfants directs de la racine persistante. Le sortant
  est protégé par le marqueur transitoire existant ; aucun état DOM n’est cloné
  sur le chemin H-i-C. CodPlay fournit la progression ; le renderer ne crée pas
  sa propre horloge.
- Les ressources H-i-C appartiennent à la transition active : aucun renderer,
  texture, buffer ou historique de frames n’est conservé entre deux
  transitions. Seul le device WebGPU est partagé par la page
  (`html-in-canvas/webgpu-device.ts`, décision utilisateur du 2026-11-26) ; sa
  perte est signalée aux transitions actives et il est redemandé ensuite. Fin, annulation et teardown libèrent les ressources GPU et le
  contexte, retirent les listeners et les références de session. À
  l’interruption, seule la composition nécessaire à la transition suivante est
  transférée ; elle est libérée avec cette transition. Une perte de contexte
  révèle la racine entrante et nettoie la présentation.
- Le parcours `replace-carousel` garde son vrai chemin `replace-media` avec
  deux effets séparés : aller à 1 500 ms, fin à 2 400 ms, retour à 4 000 ms.
  Les 1 600 ms de pause permettent d’observer chaque effet. L’interruption
  reste un cas d’acceptation distinct du scénario visuel courant.

- **A-D1 — Sessions pendant le rejeu d’un Seek** (décision interne). Le
  circuit existant suffit : le player appelle `prepareSeek(scèneCible)` sur
  chaque module avant `replayForSeek` (`seek-controller.ts`). Chaque module
  replace y dérive, par composant, la chaîne des occurrences requises depuis
  les actions de la scène cible : la dernière occurrence si sa fin majorée
  dépasse la cible, puis chaque occurrence précédente dont la fin majorée
  dépasse le début de l’occurrence requise suivante (chaîne d’interruption).
  En phase `seek`, une session n’est ouverte que pour ces occurrences ; les
  autres sont marquées traitées sans DOM ni contexte GPU. Fin majorée : durée
  de la commande plus l’enveloppe de propagation maximale (`stagger`, sinon la
  part par défaut de la durée), car la durée réelle d’un découpage texte se
  mesure dans le DOM. La majoration ne peut qu’ajouter une session inutile,
  jamais en retirer une requise. Ni nouvelle phase, ni nouvelle API ; la clé
  d’occurrence est celle de A1, commune à la scène cible et aux mises à jour.
- **C-D1 — `burn` est une transition du slot comme les autres.** Le
  fonctionnement du slot ne change pas : propriété du contenu foreign, deux
  horloges (timeline et montage externe), une session active par hôte,
  nettoyage au nouveau remplacement, à la mise à jour du contenu, au
  détachement et à la destruction, calque borné au rectangle du slot. Seule la
  transition change. Son implémentation peut différer du chemin média : elle
  suit le [site de référence](https://html-in-canvas.page/transitions/), y
  compris pour la représentation de la vue sortante.
- **C-D2 — DOM visible jusqu’au premier `paint`.** Sans frame native
  d’amorçage (`initialMedia` absent), la racine DOM reste affichée et le canvas
  reste masqué jusqu’au premier `paint` qui a chargé les deux textures ; le
  canvas prend alors l’affichage. Le chemin média garde son amorçage natif.
- **A-D2 — Réglages de grille sans `cells` sur les transitions slot d’un
  média** (RP1). Ils ne créent pas de grille : sans `split: 'cells'`, ceux que
  le build accepte sont ignorés et la transition reste entière, au lieu d’être
  abandonnée. La grille par défaut reste 4 × 3.

## Référence

- Site de référence H-i-C (modèle de `burn`, de son portage sur le slot et des
  effets de la tranche D) : <https://html-in-canvas.page/transitions/>. Ses
  deux états sont deux sous-arbres DOM vivants pendant toute la transition, de
  contenu HTML quelconque, chargés en texture sur `paint` pour les seuls états
  repeints, et sa progression se pilote de l’extérieur. Son repli
  (`document.startViewTransition`) n’est pas repris : le repli reste celui des
  décisions fixées.

## Tranche A — mécanisme commun play(t) = seek(t)

- **A1 — Clé d’occurrence stable** (RP2, confirmé). **Fait** :
  `createReplaceOccurrenceKey` (`capabilities/replace-session/`), champs
  `eventSeq` et `declarationPath` de `ComponentActionOccurrence` ; tests
  `replace-session.spec.ts`. Ajouter `eventSeq` et
  `declarationPath` à `ComponentActionOccurrence` (déjà présents dans
  `MaterializedAction`), puis former la clé des trois modules comme
  `actionOccurrenceKey` de `move`, sans indice de liste. Test d’abord, par
  `SceneBuilder` → runner : `swap` à 300 ms (600 ms), tween à 0 ms arrêté par
  `tween:stop` à 500 ms ; Play de 0 à 700 ms et Seek direct à 550 puis 700 ms
  ouvrent une seule session et donnent la même progression. Couvrir texte,
  média et slot.
- **A2 — Sessions de Seek limitées à la chaîne requise.** **Fait** :
  `ReplaceSeekRequirements` (`prepareSeek` → `commit`/`abort`, effacé à
  `onScenePresented`), fin majorée par `REPLACE_STAGGER_SHARE_UPPER_BOUND`
  (`config/replace.ts`). En vérifiant la chaîne, un écart Play/Seek antérieur
  est apparu : Play met à jour le composant avant d’échantillonner ses
  animations, Seek après ; la composition interrompue différait. Texte et
  média échantillonnent désormais la session interrompue à l’instant de la
  mise à jour avant de la capturer.
  (RP3, mesuré :
  10 sessions pour un Seek au-delà de 10 remplacements). Appliquer A-D1 après
  A1, par une seule fonction de calcul de la chaîne requise, appelée par les
  trois modules ; A4 l’intègre ensuite au suivi commun. Pour `burn`, chaque
  session rejouée crée puis libère un contexte WebGL2 (`begin` →
  `createHtmlInCanvasBurnSession` → `getContext('webgl2')`) : des erreurs
  console sur les contextes ont été observées par l’utilisateur. Relever ces
  messages avant la correction, puis vérifier leur absence. Tests, sur le
  `tag` à 10 remplacements du diagnostic : Seek à 10 500 ms → 0 session ; Seek
  à 5 100 ms → 1 session ; interruption A→B→C, Seek dans C → 3 sessions, et
  même composition qu’en Play. Vérification navigateur, dans un navigateur
  qui prend en charge H-i-C (Safari ne le fait pas et y applique le repli
  `mask-reveal`) : aucun avertissement de dépassement de contextes après un
  Seek au-delà de 20 `burn`. Contrôle fait par l’utilisateur : conforme.
- **A3 — Une règle de validation par capacité** (RP1, RP5). **Fait** pour
  les médias (garde finale `AUTHOR_MEDIA_REPLACE_INVALID` par le normaliseur
  runtime ; réglages de grille sans `cells` ignorés, A-D2) et pour `burn` +
  `cells` sur le slot. Texte et slot : règles relues, cohérentes avec leur
  normaliseur. Tests : `curtain` + `stagger`, `stack` + `direction`, `wipe` +
  `cellX` jouent en vue entière ; `burn` + `cells` est refusé au build.
- **A4 — Mécanique de session commune et code mort.** **Fait** :
  `ReplaceTimelineSessions` et `createPlayerReplaceAnimation`
  (`capabilities/replace-session/timeline-sessions.ts`) pour les trois modules ;
  code mort retiré (`normalizeReplaceSimpleCommand`, `ReplaceSimpleCommand`,
  `DEFAULT_REPLACE_DURATION_MS`, `getGridDuration`) ; valeurs par défaut dans
  `config/replace.ts` et dans la spec de présentation. Un seul suivi de session
  (`sessions`, `handledOccurrences`, annulation, `beforeSeek`/`destroy`,
  `ComponentAnimation` de progression) partagé par les trois modules ; le média
  y ajoute l’attente de frame, et le slot la présentation externe. Retirer
  `normalizeReplaceSimpleCommand`, `ReplaceSimpleCommand`,
  `DEFAULT_REPLACE_DURATION_MS` et `getGridDuration`. Regrouper en
  configuration les valeurs par défaut répétées (propagation 40 % ou 50 %,
  grille 4 × 3), puis les reporter dans les specs.

Acceptation A : `tests/runtime/capabilities/replace-module.spec.ts`,
`replace-presentation-surface.spec.ts`, `burn-session.spec.ts`,
`foreign-mount.spec.ts`, la suite CodPlay, le typecheck, les tests Sighty
`replace-presentation.spec.ts`, puis Safari sur `replace-carousel` : Play,
Seek dans chaque effet et après, interruption A→B→C.

## Tranche B — médias et H-i-C

- **Fixe, en cours — alignement DOM/amorce/H-i-C.** La grille ne change pas de
  rectangle sur le parcours observé. Le média mesure 232,296875 ×
  212,046875 CSS px à DPR 2 ; le canvas est 465 × 425. L’amorçage calcule un fit
  dans cette taille arrondie, puis `gl.viewport` tronque ses valeurs
  fractionnaires. H-i-C fournit une hauteur utile de 425,0000305, allouée à 426
  texels et échantillonnée sur toute sa hauteur. Le recalage amorce/premier
  paint à progression ≈0,004 estime un déplacement vertical de 0,5 à 0,75 pixel
  physique : l’absence de frame vide ne certifie donc pas la stabilité du
  cadrage. Correction autorisée par l’utilisateur : un rectangle CSS
  fractionnaire commun ; viewport plein canvas ; fit porté par les coordonnées
  flottantes ; UV limités à la zone utile des textures. Aligner les bords du
  support canvas sur les pixels physiques et garder la vue CSS fractionnaire à
  l’intérieur, pour supprimer le rééchantillonnage du support par le
  compositeur. Vérifier aussi le filtrage entre la source native et sa
  rasterisation DOM. Implémentation en cours dans `burn-renderer.ts` et
  `texture-mapping.ts`. Acceptation : régression numérique, recalage
  navigateur, puis enregistrement sans readback et contrôle de nettoyage.
  Avec D-D5, cette correction est reprise dans le renderer WebGPU (D1) plutôt
  que dans le renderer WebGL2, appelé à être retiré.
- **Acquis.** Dans `burn-session.ts`, `burn-renderer.ts` et le fit média
  partagé : sortie native maintenue pendant la préparation de l’entrée, taille
  fixée avant paint/upload, textures amorcées depuis le média natif sortant
  avant affichage du canvas. Le premier dessin du canvas ne dépend plus d’un
  `paint` ultérieur ; les paints suivants portent les slots vivants. Aucun
  clone, canvas 2D d’amorçage, chargeur ou ressource conservée entre effets.
  Acceptation faite : 293 tests ciblés, typechecks CodPlay et démos, build des
  démos ; deux parcours enregistrés du compositeur sans readback GPU, sans
  frame de fond dans les zones image et vidéo avant les effets ; le rejeu
  libère les quatre contextes et conserve un seul média courant. La perte de
  contexte, le Seek simple, le resize et la capture après paint ont leur
  acceptation navigateur ; l’initialisation des médias natifs et les fits
  `cover`/`contain`/`fill` sont couverts par les régressions de session.
- **A relire — reconstruction avant premier paint.** Un Seek qui traverse
  plusieurs remplacements peut demander une capture avant que la première
  session ait reçu `paint`. Les textures d’amorçage ne portent alors que la
  sortie native, sans la composition intermédiaire des deux états DOM ; ce
  résultat ne satisfait pas encore l’acceptation Seek de l’interruption.
  A2 retire les sessions rejouées et réduit ce cas à l’interruption réellement
  visible à la cible ; définir ensuite son articulation avec l’attente de
  peinture. Ne pas ajouter de clonage ni d’historique de frames pour la
  contourner.
- **B1 — `fade` désigne deux effets** (RP4). **Fait** : sur un média,
  `fade` prend le preset JSON (décision utilisateur). Un fondu n’a pas de
  masque : ses options de masque (`split`, `shape`, grille) sont acceptées puis
  ignorées, sur un média comme sur un slot, comme les anciens splits texte du
  slot (`ignoreFadeMaskOptions`). Specs média et slot à jour. La grille
  implicite d’A-D2 reste limitée aux transitions du slot.
- **B2 — Normalisation une fois par occurrence** (RP5). **Fait** : la
  dernière occurrence valide est cherchée depuis la fin de la liste ; une
  seule normalisation en général et un calcul linéaire du contenu sortant.
- **Restant.** Automatisation navigateur H-i-C, et certification des relations
  foreign ou parent-enfant imbriquées, reparent et teardown en transition
  compris. Le POC image et vidéo ne vaut pas certification de ces usages.

## Tranche C — `burn` sur le slot

État : `replace-slot` accepte `burn` (900 ms, sans `split: 'cells'`), et
`createHtmlReplacePresentationSurface` envoie toute racine `div` vers la session
H-i-C, slot compris. Ce chemin n’est ni testé ni certifié ; la spec le dit
(« les relations foreign imbriquées ne sont pas certifiées »).

- **C1 — Relevé de l’existant, sans changer le code.** Test par
  `foreign-mount.spec.ts` (montage externe, horloge d’opération) et par une
  action de slot sur la timeline : quels éléments la session prend comme
  sortants, quand l’instance sortante est démontée ou détruite, ce que devient
  `start` quand le contenu foreign contient une image ou une vidéo pas encore
  prête (le chemin externe appelle `start` sans attendre son résultat).
  Consigner l’écart avec C-D1 dans ce plan.
- **État :** C2 et C3 sont couverts par la session H-i-C commune (tranche D) :
  sur un slot, la vue sortante est une copie temporaire de son contenu, comme
  pour ses autres transitions, et les états ne sont jamais masqués par
  `visibility` ; repli `mask-reveal` borné au slot. Tests
  `html-in-canvas/session.spec.ts`. C1 (relevé navigateur du montage externe)
  se fait avec le contrôle de la démo `hic-slot`.
- **C2 — Session `burn` du slot.** D’après le
  [site de référence](https://html-in-canvas.page/transitions/) (C-D1), avec
  le même renderer, le même cycle de ressources et le même repli que le chemin
  média, sans second circuit de transition du slot. DOM visible jusqu’au
  premier `paint` (C-D2). Le calque reste borné au rectangle du slot
  (`clipToSlot`). Pour une action de timeline, la session suit l’horloge player
  et A1/A2 ; pour un montage externe, l’horloge d’opération, sans réaction au
  Seek de l’hôte. Les deux états sont les contenus DOM sortant et entrant du
  slot, comme sur le site de référence. Limites de la référence à respecter :
  - un état en `visibility: hidden` ne produit aucune image : la session ne
    masque pas ses états par le masquage transitoire actuel
    (`HIDDEN_PROPERTIES`, `motion-style-layer.ts`) ;
  - la première image arrive après deux paints : C-D2 couvre cet intervalle ;
  - le contenu en top layer (dialogue modal, popover) n’entre pas dans l’image
    d’un état : limite à inscrire dans la spec slot.
  Tests : le canvas n’est pas affiché avant le premier `paint` ; aucun état
  présenté au canvas ne porte `visibility: hidden` ; les cas slot existants
  (`foreign-mount.spec.ts`, `replace-module.spec.ts`) passent avec `burn` comme
  avec `mask-reveal`.
- **C3 — Repli du slot.** Vérifier que l’absence de H-i-C ou de WebGL2 donne le
  `mask-reveal` circulaire borné au slot, pour les deux horloges.

Acceptation C : `foreign-mount.spec.ts` et `replace-module.spec.ts` (slot,
deux horloges, repli), tests Sighty `replace-presentation.spec.ts` et
`sighty-demo4.spec.ts`, puis Safari sur une démo Sighty à montage de slot :
aucune frame vide à la bascule, nettoyage après fin, annulation, perte de
contexte et destruction de l’instance sortante, et repli quand H-i-C est
absent. Mettre à jour les specs slot et présentation avec le comportement
vérifié.

## Tranche D — effets du site de référence

Demande : porter tous les effets du [site de référence](https://html-in-canvas.page/transitions/)
sur `replace-media` et `replace-slot`. Aujourd’hui seul `burn` existe, avec un
shader écrit en dur dans `burn-renderer.ts`.

Effets du site : `shatter`, `fold`, `burn`, `morph`, `fade`, `ripple`,
`pixelate`, `swirl`, et un shader auteur. Le site définit un effet par un
shader `vec4 transition(vec2 uv)` qui lit `getFromColor`, `getToColor`,
`progress`, `ratio` et `origin` (avec un `pick()` facultatif), ou par une
fonction de maillage `(progress, { W, H, quad, tri })`.

Décisions fixées (utilisateur, 2026-11-26) :
- **D-D5 — WebGPU.** Les effets passent par WebGPU
  (`device.queue.drawElementImageToTexture`) et des shaders WGSL, comme le
  site. `burn` est porté sur ce renderer ; le renderer WebGL2 actuel est retiré
  après le portage. Sans H-i-C ou sans WebGPU, le repli s’applique.
- **D-D4 — Repli :** `mask-reveal` circulaire pour chaque effet, comme `burn`.
- **D-D1 — Pas de `fade` H-i-C :** le nom reste au preset JSON et au profil
  du slot.
- **D-D2 — Catalogue seul :** pas de shader auteur dans une scène pour
  l’instant.
- **D-D3 — Pas d’interaction pendant la transition** (`updateElementGeometry`
  hors périmètre).

- **État (implémenté, en attente du contrôle navigateur).** Module
  `runner-html/replace-presentation/html-in-canvas/` : `effects.ts` (prélude
  WGSL commun et les six effets), `webgpu-renderer.ts`, `session.ts`,
  `texture-mapping.ts` ; le renderer WebGL2 et `html-in-canvas-burn/` sont
  retirés. Chaque transition demande son propre device WebGPU, détruit à sa
  fin ; tant qu’il n’est pas prêt, seul le DOM sortant est affiché, puis le
  canvas prend le relais à la progression courante. Les six modules WGSL et
  leurs pipelines sont validés par le WebGPU de Safari Technology Preview
  (sans H-i-C). Démos : V2 `hic-transitions` (une image par effet, une vidéo)
  et Sighty `hic-slot` (une scène de slot par effet). Médias contrôlés par l’utilisateur dans Brave (rendu
  correct, effets séquentiels, plus de frame noire) et reportés dans les specs.
  Reste le contrôle du slot (`hic-slot`), de l’interruption, de la perte du
  device et du resize.
- **D1 — Renderer H-i-C WebGPU paramétré par effet.** Le renderer `burn`
  devient le renderer H-i-C commun en WebGPU : mêmes slots `drawable`, même
  amorçage, même cycle de ressources (device, textures, pipeline libérés à la
  fin, à l’annulation et à la perte du device), même repli, même horloge player
  ou d’opération. Un effet fournit son shader WGSL au contrat du site ; `burn`
  devient le premier effet. L’alignement en cours de la tranche B (rectangle
  CSS fractionnaire commun, zone utile des textures) est repris dans ce
  renderer. Aucun second circuit de session.
- **D2 — Effets par shader :** `ripple`, `pixelate`, `swirl`.
- **D3 — Effets par maillage :** `shatter`, `fold`. Le renderer dessine
  aujourd’hui un seul rectangle plein cadre ; il lui faut une géométrie fournie
  par l’effet.
- **D4 — `morph` : retiré** (décision utilisateur : plus gênant
  qu’intéressant).

Chaque effet : test de session (jsdom, frontière GPU remplacée comme dans
`burn-session.spec.ts`), repli testé, puis contrôle utilisateur dans un
navigateur qui gère H-i-C sur `replace-carousel` et sur un slot.

## Reprise — 2026-11-27 à 00:05

Demande utilisateur : réaliser l’ensemble des optimisations, dans cet ordre.
1. H-i-C : ne copier en texture que les états repeints (`paint.changedElements`) ;
   la copie sortante d’un slot n’est copiée qu’une fois.
2. H-i-C : réutiliser le tableau et le buffer des paramètres du shader.
3. H-i-C : un device WebGPU partagé entre transitions (lève la décision « aucune
   ressource GPU conservée » pour le seul device ; textures, pipelines et
   contexte restent libérés à chaque fin). Mettre à jour les décisions fixées.
4. Remplacer les mesures DOM restantes ci-dessous par la capture affine.
5. Doublons de fonctions dans tout replace.
Puis tests, typechecks, build des démos, contrôle utilisateur dans Brave, specs.

État au 2026-11-27 : 1 à 5 faits ; tests CodPlay, Sighty et Editor dans leur
état de base, typechecks et build des démos propres ; specs média, texte et
présentation à jour. Reste le contrôle utilisateur dans Brave (médias, slot,
parent transformé).

## Mesures DOM

Règle du projet appliquée à tout replace : aucune géométrie mesurée par
`getBoundingClientRect`. Tailles locales par `getLocalBoxSize` (dimensions CSS
non transformées), position dans le parent et zone H-i-C par `captureHtmlPose`.
Seules les boîtes `Range` du texte restent en coordonnées d’écran, rapportées
à la racine du texte prise comme racine de capture.

## Critères d’acceptation

- play(t) = seek(t) pour chaque transition replace : même session, même
  progression et même composition, en Play comme en Seek direct, y compris
  quand une action plus ancienne quitte la liste du perso.
- Un Seek n’ouvre qu’une session par composant, celle active à la cible ;
  aucun contexte WebGL2 n’est créé pour une transition déjà terminée.
- La vidéo entrante visible progresse pendant la transition entière au même
  rythme que son nœud natif ; le média `media-sync` reste l’unique lecteur.
- H-i-C échantillonne deux contenus distincts ; la vidéo entrante reste vivante
  dans son slot et l’interruption repart de la composition H-i-C visible.
- Sans H-i-C ou WebGL2, le repli déclaré s’applique, sans changer la durée.
- Fin, annulation, Seek, perte de contexte et teardown retirent les couches et
  restaurent la racine sans fond noir ni avertissement de dépassement de
  contextes. Aucune ressource de transition n’est gardée pour un usage futur.
