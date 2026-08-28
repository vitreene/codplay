# État = f(scène, t) — le seek sans reconstruction progressive

Étude de réflexion (2026-07-26). Ambition (auteur) : que l'**état à `t` soit accessible sans
reconstruction progressive**, seulement comme **projection de l'état de la scène** — comme three.js
(ou un shader, une timeline déclarative). Le seek devient une **évaluation**, pas un **rejeu**. Aucun
code — trace de l'étude, faisabilité à *inventorier* (pas spéculer). Contexte : chapitre du cahier
des charges V2 (`2026-07-16-solve-project-moteur-custom.md`).

## La question rigoureuse

`état(t) = f(scène, t)`, pur, sans accumulation. Critère de tri, appliqué à chaque dimension :
**puis-je calculer sa valeur à `t` en connaissant seulement la scène et `t`, sans savoir par quel
chemin on est arrivé à `t` ?** Ce qui répond oui devient interrogeable (réversible) ; ce qui répond
non est un effet accumulé (rejeu orienté).

## Tout état se lit par INTERROGATION, jamais par REJEU

```
   • continu (interpolation style/pose/couleur) → évaluation f(t)   [DÉJÀ : capturePersoStatesMirror]
   • discret (move on/off, transforms discrètes) → FENÊTRE DE VALIDITÉ [déjà implémenté, réversible]
   • capturé (persist, mesure DOM ponctuelle)    → valeur FIGÉE relue  [enregistrée une fois]
   • interaction                                 → ÉCRIT/enrichit la scène → redevient f(t)
```

- **Continu** — déjà `f(t)` : `capturePersoStatesMirror` *évalue* l'état d'une transition à `t` sans
  rejeu (seek d'un adaptateur éphémère). **Preuve en prod que le modèle marche** sur le sous-domaine
  continu. La V2 étend ce principe d'évaluation au reste.
- **Discret — les fenêtres de validité** (mécanisme auteur déjà implémenté et récupéré). Chaque
  transformation discrète (`move` en tête) porte une fenêtre `[début, fin)` où son état est vrai.
  `placement(t)` = **trouver la fenêtre contenant `t`**, pas rejouer les moves jusqu'à `t`. C'est ce
  qui rend le placement `f(t)` ET **réversible** : une fenêtre se lit dans les deux sens (`t` dedans
  ou non, l'ordre de parcours n'importe pas) — un rejeu, lui, est orienté avant-seulement. Le on/off
  (`@off`) est une valeur de la piste comme une autre.
- **Capturé (`persist`)** — mémoire d'une capture **non traçable** (non re-dérivable depuis la scène :
  un pointermove, une mesure DOM ponctuelle). Ce n'est PAS un effet à ré-exécuter : c'est une **valeur
  figée** que le seek **relit**. Relire une valeur figée est `f(t)`. Seule sa *production* n'était pas
  `f(t)` — et elle a eu lieu une fois, au live. `persist` est donc *comment* le modèle absorbe
  l'imprévisible : en le figeant en donnée interrogeable.
- **Interaction** — enrichit la scène, qui **conserve un état stable : l'indétermination résolue**.
  Une interaction n'est pas un flux externe qui s'accumule à côté du modèle ; c'est une **écriture
  dans la scène** qui la fait passer d'indéterminée (« cliquera-t-il ? ») à déterminée (« il a cliqué
  à t₀, fait stable »). Après, la scène est de nouveau `f(t)` complète. L'« accumulation » n'est qu'un
  transitoire de résolution, pas un état vivant à maintenir.

## L'irréductible — ce qui NE devient pas f(t)

**Les straps NE sont JAMAIS rejoués — ni en `f(t)` ni en V1** (précision des specs, `v1-seek-spec` :
« le seek ne réexécute pas les straps », « listen/strap/émission réactive hors champ de la relecture »).
Un strap est du **code à effet** (async, émet des events), qui ne tourne **qu'en play**. Ce que le seek
relit, ce sont ses **SORTIES matérialisées** dans les tracks (« mutations rejouées comme **données, pas
comme code** »). Donc la séparation de `f(t)` (état interrogeable vs effet) **est déjà celle du seek V1**
entre *sortie matérialisée* (relue) et *strap* (jamais rejoué). `f(t)` ne réforme pas ça — il le
**généralise** à tout (placement, décor), et remplace le *rejeu-depuis-le-début* (V1, « le runtime
repart du début des tracks ») par l'*évaluation directe à `t`*. Le **quoi lire** (les sorties, pas les
straps) est identique ; seul le **comment y accéder** change.

- **Effets à side-effect** (déclencher un média, un side-effect externe) — non-idempotents ; une
  fonction pure ne « déclenche » pas. Au seek, filtrés (rejouables ou non — `shouldReplayEventForSeek`,
  `persist-only` présentés dans les tracks sont relus normalement). Rares, déjà isolés.
- **Interaction non encore matérialisée** — mais une fois matérialisée (event écrit dans un track),
  elle rejoint `f(t)`. (Le cas seek-back sur interaction utilisateur est un **cas ouvert reconnu en
  V1** — `v1-seek-spec` appendice « invalidation des events utilisateur après seek-back » ; la
  propriété de piste `onSeekBack` ci-dessous en est une réponse.)

## La ligne à graver

> L'**état visuel** (où / comment : pose, décor, style, placement) devient `f(t)` par évaluation de la
> scène-augmentée-de-sa-trace, réversible. Les **straps** (le code comportemental) ne tournent qu'en
> **play** et n'y sont **jamais** rejoués — le seek relit leurs **sorties matérialisées**. Les **effets
> à side-effect** (média, externe) sont filtrés au seek (relire l'effet ≠ le re-déclencher). Le seek
> « sans reconstruction » est atteignable pour l'état ; les straps/effets sont déjà hors champ du seek
> par la spec V1 — `f(t)` ne change pas ça, il le généralise.

**Ce n'est PAS un store d'état accumulé** (concept refusé, cf. réticences B/C du doc V2 : coûteux en
échecs/bugs). C'est l'**inverse** : supprimer l'accumulation en rendant chaque dimension interrogeable
par `t`. Un placement n'est pas muté-et-mémorisé, il est *lu dans sa fenêtre à `t`*. **C'est moins
d'état, pas plus** — peut-être la raison des échecs passés : ils ajoutaient de l'état à maintenir, là
où la bonne direction est d'en retirer.

## Corollaire — la lecture de SEGMENT devient une primitive de premier ordre

Conséquence directe de `f(t)`, impossible en V1 : **jouer une portion `[t1, t2]`, pas la scène
complète depuis 0.** En V1, atteindre `t1` passe par le rejeu de tout ce qui précède
(`replayDueTimelineEventsForSeek`) — le point d'entrée traîne son passé. En `f(t)`, atteindre `t1` est
une **évaluation directe** (`f(t1)`), sans reconstruction ; on avance ensuite incrémentalement jusqu'à
`t2`. Le segment n'est plus « jouer depuis 0 puis s'arrêter » mais une **primitive** — même déblocage
que le reverse (l'orientation-depuis-zéro disparaît : tout `t` est un point d'entrée gratuit, donc tout
`[t1, t2]` est jouable directement).

Débloque : **édition** (prévisualiser la portion travaillée entre deux bornes sans rejouer toute la
scène — le geste d'atelier « inspecter une portion ») ; **diffusion segmentée** (chapitres, boucles,
extraits indépendants) ; **scrubbing borné** (progress limité à une zone).

**Nuance (même irréductible que partout)** : le segment est gratuit pour l'**état visuel** (`f(t)`),
mais les **effets à side-effect** qui auraient dû se produire *avant* `t1` ne se rejouent pas si on
saute directement à `t1`. Pour un segment c'est généralement *souhaitable* (voir la portion, pas
re-déclencher son passé) — mais à assumer explicitement, pas à découvrir. Le média master, lui, se
resynchronise par dérive (média-sync) au point d'entrée du segment — le son cale au bon endroit sans
rejeu.

## Faisabilité = un inventaire, pas un pari

L'écart entre ce modèle et le code = **combien d'états sont encore accumulés-par-rejeu au lieu
d'interrogeables**. Symptôme : `runTimelineEvent` rejoué un par un dans
`replayDueTimelineEventsForSeek` (`create-player.ts`). Question mesurable (pas spéculative) : passer en
revue ce que `runTimelineEvent`/`shouldReplayEventForSeek` traitent et classer chaque cas en *« déjà /
potentiellement fenêtre de validité »* vs *« effet irréductible »*. Si presque tout tombe dans le
premier, le système est **extrêmement puissant** (formule auteur). La preuve est un inventaire des
events rejoués, pas une refonte à l'aveugle — c'est ce qui distingue ce modèle des chantiers B/C
refusés (il *vérifie* que l'existant couvre le champ, il ne construit pas un concept fragile).

## Comportement de piste au seek-back — une convenance auteur (pas un invariant runtime)

Flou actuel constaté : des events ajoutés par interaction et situés **devant** la tête après un
seek-back ne sont pas effacés — ils se rejoueront au play suivant, alors que leur cause (l'interaction)
ne s'est pas reproduite dans le nouveau parcours.

Résolution (cadrée par l'auteur, sans approfondir) — **tout est déjà dans `track`** : pistes nommées,
un strap désigne où il écrit ses events. Il manque juste, éventuellement, **une propriété sur la piste
décrivant son comportement** (ex. `onSeekBack: 'clear-ahead' | 'persist'`). Le strap qui écrit ses
events d'interaction sur une piste `clear-ahead` a, de fait, déclaré leur comportement — **pas besoin
d'un marqueur d'origine par event ni de tracer une causalité** (piste level, pas event level).

**Distinguer d'abord deux natures d'interaction** (cf. frontière auteur/diffusion,
`2026-07-26-conduite-chantier-v2.md` §5) — sinon le raisonnement conflère deux choses :
- **interaction d'ÉDITION** (geste d'atelier dans l'éditeur) — n'existe pas en diffusion. Le seek-back
  y est un geste d'inspection de l'auteur ; l'effacement-devant-la-tête est une **convenance auteur /
  debug** (`onSeekBack: 'clear-ahead' | 'persist'`), pas un invariant runtime.
- **interaction de l'ŒUVRE** (réponse au quiz, dessin, clic sur un élément interactif) — **fait partie
  de la scène et existe PLEINEMENT en diffusion.** Donc, contrairement à une première formulation
  (corrigée), **la question PEUT se poser en diffusion** : une œuvre qui offre au spectateur de revenir
  en arrière rejouerait à travers ses propres interactions passées. Le comportement à ce seek-back
  (rejouer le quiz ? garder la réponse ?) relève alors de la **sémantique voulue par l'auteur pour son
  œuvre** — une décision d'authoring inscrite dans la scène, pas une convenance de debug.

**Le mécanisme est le même dans les deux cas** — une propriété de piste (`onSeekBack`) déclarée par le
strap qui y écrit ses events. Ce qui change, c'est **qui décide et pour quelle finalité** : debug
d'atelier (édition) vs comportement conçu de l'œuvre (diffusion). Raison commune de vouloir l'effacement
possible : rejouer à travers des interactions passées **tout en autorisant à en ajouter d'autres**
superpose deux histoires → confusion. L'effacement-devant-la-tête n'est donc pas « la » sémantique
correcte dans l'absolu — c'est **un mode déclaré**, par convention de piste, choisi selon l'intention
(repartir propre vs inspecter/conserver l'historique).

Conséquence sur le modèle `f(t)` : l'effacement n'est **pas une condition** de `f(t)` — le modèle reste
cohérent avec ou sans (une interaction non effacée reste un fait `f(t)` de la scène ; effacée, elle
rouvre l'indétermination). C'est une **propriété de piste déclarée**, pas un invariant du runtime.
Encore *moins* de mécanisme : une convention descriptive, pas une causalité tracée.

## Statut

**Point CONSTITUTIF de la V2 et ATTEIGNABLE** (acté par l'auteur 2026-07-26) — pas une étude
optionnelle à côté. `f(t)` fait partie du cahier des charges V2 au même titre que solve/project et la
Projection. **Faisabilité à inventorier** (events rejoués → fenêtre-de-validité vs effet irréductible),
non encore planifiée — mais démonstrative, pas spéculative : ancrée sur du déjà-en-prod
(`capturePersoStatesMirror`, fenêtres de validité, `persist`, matérialisation). Lié :
`2026-07-16-solve-project-moteur-custom.md` (cahier des charges V2, S5 solve, S7 seek≡play),
`2026-07-26-seek-flip-ancetres-mobiles.md` (le cas où `f(t)` seul ne suffit pas — mesure irréductible).
