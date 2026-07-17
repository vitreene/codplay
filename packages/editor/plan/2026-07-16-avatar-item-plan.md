# ed2 — Item avatar : spec et plan de chantier

**Type** : Spec + Plan. **Statut** : écrit (2026-07-16), chantier futur — outillage d'un développement à venir, rien d'implémenté côté ed2.

**Objet** : intégrer le composant `avatar3d` (marionnette 3D de présentation, pilotée par la voix) dans ed2 comme un type d'item à part entière, avec ses pistes d'édition dans le sequence-editor et un système de macros pour les utilisateurs novices.

**Références** :
- composant : `packages/authoring/components/avatar3d/` + `packages/authoring/components/avatar-engine/` — API entièrement événementielle et seek-safe (`play(t) = seek(t)`), cf. `docs/formalisation/2026-07-16-avatar3d-session-handoff.md` ;
- démo de référence : `packages/demos/src/scenes/avatar-poc-scene.ts` (`?demo=avatar-poc-1`) ;
- modèle de document : `packages/editor/plan/app/2026-07-11-ed2-document-model.md` (le grain phonème/visème y est déjà réservé comme « couche ajoutée à son chantier ») ;
- précédent architectural pour l'expansion : capsule-automation / `CapsuleDistribution` (catalogue + expansion pure consommée par le Builder).

La discussion d'origine est résumée en **appendice** ; le corps du document est normatif pour ce chantier.

---

## 1. Conditions de présence de l'avatar

Quatre conditions, indépendantes :

1. **Autorisation contractuelle** (côté user, dans son contrat) — feature hypothétique, **hors périmètre** de ce chantier. Prévoir seulement que l'entrée UI « ajouter un avatar » soit désactivable par un flag externe.
2. **Activation par l'auteur** : l'avatar n'existe que si l'auteur le crée. C'est un **item normal** — il se positionne, se déplace, a son décor et ses keyframes comme les autres.
3. **Présence d'une voix** : la disponibilité des **visèmes** sur le son master est l'indicateur que l'avatar peut être ajouté (gating de l'entrée UI). Pas de voix transcrite → pas d'avatar proposable.
4. **Affichage** : un item avatar **masqué** (visibilité d'éditeur) est **exclu du rendu de la scène** — il n'y existe plus. Distinct des **bornes intro/outro** (§6) : à l'intérieur de la scène, le perso reçoit les visèmes en cours et joue son animation, même hors écran. La voix, elle, ne dépend jamais de lui.

Dès que l'avatar est ajouté à la scène, **ses pistes dédiées apparaissent** dans le sequence-editor (§4).

## 2. L'item avatar dans le modèle de document

- **`ItemType`** : nouvelle valeur distincte (`avatar`), conformément à la règle actée « futurs types = valeurs distinctes, jamais des discriminants sous `media`, ajoutés à la disponibilité du composant Codplay correspondant ».
- **Contenu** : le personnage (modèle GLB) est *ce que l'item montre* → `Content` avec `source` = URL du modèle, comme un média. Le choix du personnage est donc un changement de `Content.source`.
- **Capacités propres au type** → **`Item.avatar` (typeDef)**, miroir de `Item.capsule` : tempérament (§5), transitions et bandeaux des canaux (§3), occurrences de macro (§7). Règle du modèle respectée : « capacités propres au type, statiques ou temporelles spécifiques → `Item.<typeDef>` ».
- **Décor / keyframes** : inchangés — l'avatar est un item ; son emprise (canvas), sa position, ses intro/outro passent par le mécanisme commun.
- **Customisation (UI)** : dans **dedit, comme module distinct** (au même titre que les modules capsule ou media). Le module édite `Content.source` (choix du personnage) et `Item.avatar.temperament`. Les capacités de customisation fines (couleur du vêtement, logo…) **dépendent du modèle choisi** — hors périmètre, à traiter côté avatar-engine d'abord.
- **Un seul avatar par scène en v1** : contrainte du **moteur de validation**, jamais gravée dans la structure (le multi-avatar — dialogue — est un horizon explicite, cf. §8 Builder).

## 3. Le modèle temporel — escalier et excursions

Deux natures de posables, qui couvrent tous les canaux :

### 3.1 Transitions ponctuelles — l'escalier (état ambiant)

Une **transition ponctuelle** est posée à un instant. Elle fait passer un canal vers un nouvel état, qui **tient jusqu'à la transition suivante** sur la même piste (fonction en escalier). Sa **vitesse est réglable** (durée de la transition elle-même — le moteur le supporte déjà : `avatar:camera` accepte `durationMs`, les motions ont leurs transitions de geste).

S'appliquent en transitions ponctuelles :
- **le cadrage** : presets caméra (tête / torse / entier × orientations) — on coupe vers un cadrage et on y reste, comme un plan au montage ;
- **les gestes d'état** : poses tenues (`pose_side`, `pose_straight`, `hand_raise`…). « Lever le bras » peut être suivi de n'importe quoi, y compris son opposé « baisser le bras ». La démo POC fonctionne déjà exactement ainsi.

L'**état ambiant** d'un canal à l'instant t = la valeur de son escalier (dernière transition ≤ t), avec pour base avant toute transition : cadrage standard, pose idle, humeur du tempérament, **regard vers le lecteur** (le `GazeService` actuel fait précisément cela — viser la caméra — c'est la base du canal regard, pas une limitation). Le regard n'a pas de piste propre : il ne quitte le lecteur que le temps d'une excursion (macro), et y revient.

### 3.2 Bandeaux à durée — les excursions

Un **bandeau** occupe un intervalle `[startMs, startMs + durationMs]`. C'est une **excursion** : départ depuis l'état ambiant, retour **à l'état ambiant calculé depuis le document** à la fin — jamais à « ce qui était live avant » (l'indéterminisme au seek est proscrit par construction).

S'appliquent en bandeaux :
- **les expressions** : l'humeur tient sur l'intervalle, transitions d'entrée/sortie aux bornes, retour à l'humeur du tempérament ;
- **les gestes à durée** : gestes dont le sens est de durer (applaudir, danser…) ;
- **les macros** (§7).

**Sémantique de la durée d'un geste à durée** — un motion a une durée intrinsèque (implicite dans ses `dt` ; le catalogue n'a **pas de flag de remplissage aujourd'hui** — extension catalogue requise). Chaque motion déclare son comportement :
- `one-shot` : joue une fois, puis tenue de la pose finale ou retour idle pour le reste du bandeau ;
- `loop` : boucle pour remplir le bandeau.
Jamais d'étirement temporel du clip (dénaturant). Durée par défaut du bandeau = durée intrinsèque du motion.

### 3.3 Nature déclarée au catalogue

C'est le **catalogue** (côté avatar3d) qui déclare la nature de chaque geste : `state-transition` (ponctuel, escalier) ou `one-shot`/`loop` (bandeau). L'UI d'ed2 en dérive la représentation (icône ponctuelle vs bandeau) — jamais de décision de nature côté éditeur.

## 4. Les pistes dans le sequence-editor

**Volet avatar repliable/dépliable d'un clic**, proche de la piste son. Lignes :

| Piste | Posable | Représentation |
|---|---|---|
| mots | — (existante, dérivée des cues) | repères existants |
| gestes + actions (= macros) — **piste commune** | transitions ponctuelles **et** bandeaux (selon nature catalogue) | icône ponctuelle / bandeau avec icône ; réglages propres pour les macros |
| expressions | bandeaux | bandeau avec icône |
| cadrage | transitions ponctuelles | icône ponctuelle |

**Pourquoi la piste commune gestes/actions** : la garantie de non-chevauchement est portée par la piste — ce qui ne doit pas se toucher vit sur la même piste. Gestes et macros pilotent les mêmes canaux moteur : leur cohabitation rend toute règle de collision inter-pistes inutile (§7.3).

- **Pas de piste visèmes** : trop bas-niveau, le lipsync est automatique.
- **Icônes et libellés** : icône dédiée quand elle existe, sinon générique + label. Les libellés partent des **traductions des noms de gestes du catalogue**, dans un **JSON éditable plus tard** (i18n).
- **Manipulation des bandeaux** : posé avec la **durée par défaut indiquée par la définition du geste au catalogue** (l'éditeur la montre), puis **étendre, déplacer, effacer**. Simplification possible pour les gestes : les montrer **ponctuels avec un paramètre de vitesse** (lent / rapide), plus intuitif pour l'auteur que l'étirement — la durée se dérive alors de la durée intrinsèque et de la vitesse. Choix de représentation à trancher au chantier 3.
- **Manipulation des ponctuels** : poser, déplacer, effacer ; réglage de vitesse de transition.
- **Non-chevauchement par piste** : v1, une seule expression à la fois, un seul geste ou macro à la fois ; les posables se suivent sans se superposer (contrainte de collision au drag/étirement, même famille de logique que la manipulation de keyframes).
- **Aimantation aux cues-mots** : les cues sont déjà aimantées — poser un geste ou un cadrage sur une frontière de mot est le geste d'édition naturel d'une présentation parlée.
- Rendu : nouveau renderer de rangée (bandeaux + icônes) à côté de `cue-row` / `marker-row` / `waveform-row` ; le volet repliable relève de `LayoutProfile`/`DisplayConfig`.

## 5. Le tempérament — réglage général de l'avatar

Un paramètre d'item règle l'**humeur générale** et le **niveau d'agitation** pour toute la scène : sérieux et statique ↔ souriant et mobile. Côté UI : quelques réglages simples et compréhensibles. Côté ed2 : « presque une macro » — un **preset statique** que le Builder déplie en configuration initiale du perso (aucun événement daté) :

- **humeur générale** → `Avatar3DInitial.mood` (existe) — c'est **l'ambiant du canal expression**, la valeur vers laquelle tout bandeau d'expression revient ;
- **agitation** → paramétrage des comportements automatiques (blink / breathe / head-drift) et de la mobilité idle. ⚠ Les fabriques actuelles (`createBlinkScheduleFn`, `createBreathTriggerFn`, `createHeadDriftFn`) sont **sans paramètres** (périodes/amplitudes en constantes) : extension composant requise — facteurs d'amplitude/fréquence, en **préservant leur pureté resync-safe** (fonctions déterministes d'`elapsed`).

**Alignement automatique sur le ton de la voix — hors périmètre pour le moment (prospectif).** L'humeur d'ambiance peut aussi se **déduire de la voix** et être transmise à l'avatar sans autorage :
- voix enregistrée → **analyse du ton** à l'import (brique d'analyse prosodique/émotionnelle, à la même étape que la transcription — ce n'est pas whisper lui-même, mais le même point du pipeline) ;
- voix **générée** (TTS) avec un ton demandé → le ton est **déclaré**, aucune analyse : l'avatar s'aligne dessus directement.
Dans les deux cas la donnée est la même : un **grain tonal** du `Content` du master (§6), segments `{startMs, endMs, ton}` avec leur provenance (`analyzed` / `declared`). Ce grain **alimente l'escalier du canal expression** : le Builder en dérive les transitions d'humeur ambiante. Préséance, du plus fort au plus faible : **bandeau d'expression autoré > ton de la voix > humeur du tempérament**. Côté UI : un interrupteur d'item simple (« aligner l'humeur sur la voix »), pas de nouvelle piste — l'auteur garde la main en posant un bandeau par-dessus. Extension naturelle du même principe, à évaluer plus tard : dériver aussi l'**agitation** de l'énergie vocale.

## 6. La voix, les visèmes, la visibilité

- **Pipeline** : à l'import du son master, extraction des **visèmes** (forced alignment, grain phonème) stockés dans le `Content` du master à côté des `cues` (grain mot) — conforme à la réservation du modèle de document. Whisper fournit déjà les mots ; le forced alignment est la brique à ajouter.
- **Grain tonal** (prospectif, hors périmètre pour le moment) : segments de ton de la voix, analysés à l'import ou déclarés par la génération TTS — même patron de stockage, consommé par l'alignement d'humeur automatique (§5). Granularité pressentie : la phrase (cohérent avec le futur grain phrase des sous-titres).
- **Gating** : la présence de ce grain est la condition d'ajout de l'avatar (§1.3).
- **Le Builder émet les `avatar:viseme` pour toute la voix**, indépendamment des intervalles de visibilité de l'item avatar.
- **La voix suit son flux normal.** Deux régimes distincts, à ne pas confondre :
  - **masquage** (visibilité d'éditeur) : l'avatar est **exclu du rendu de la scène** — il n'y existe plus, rien à synchroniser ;
  - **bornes intro/outro** : le perso existe dans la scène ; l'avatar peut apparaître après le début de la voix, ou disparaître puis revenir — il **reçoit les visèmes en cours et joue son animation en continu**, hors écran compris : toute apparition tombe sur un état juste (et le seek dispose de la mécanique `isSeekReplay`).

## 7. Les macros

**Vocabulaire** : « macro » en interne et dans les specs ; « **action** » est le libellé UI. Ne pas confondre avec `perso.actions` (Codplay).

### 7.1 Définition — le catalogue

Une macro est une **séquence chorégraphiée nommée et paramétrée** : phases internes (se tourner, orienter le regard, geste, mouvement caméra simultané, retour), touchant plusieurs canaux à la fois. Le catalogue de macros vit **côté authoring** (package dédié ou sous-module d'avatar3d), sur le modèle capsule-automation : **définitions + fonction d'expansion pure**, testable sans DOM.

Chaque définition déclare :
- ses **phases** et leur timing relatif ;
- sa **phase élastique** (la tenue) : étirer le bandeau étire cette phase seule, les phases d'entrée/sortie gardent leur vitesse naturelle ;
- les **canaux qu'elle touche** (geste, regard, caméra) — documentaire, et déterminant si des pistes venaient à se séparer un jour ;
- ses **paramètres** exposés (les « quelques réglages » UI). Le modèle de `params` **admet des références d'entités de scène** (item id, zone id, point libre) — provision v1 pour le pointer-vers-cible (§9), résolue par le Builder, jamais par le runtime.

### 7.2 Occurrence — dans le document

Une occurrence de macro est un **bandeau** (§3.2) sur la piste « actions » : `{ id, macroId, startMs, durationMs, params }`. **Le bandeau reste UN objet** du document — déplaçable, étirable, supprimable — jamais aplati en événements à l'autorage. L'expansion est exclusivement l'affaire du Builder.

### 7.3 Excursion multi-canaux et collision

Une macro part des états ambiants des canaux qu'elle touche et **y revient** (au cadrage courant de l'escalier, à l'ambiant du canal). En v1, les macros ne pilotent pas le canal expression ; si elles le font un jour, le principe de cohabitation ci-dessous s'applique.

**Collision — garantie structurelle, pas règle de validation** : ce qui ne doit pas se toucher **vit sur la même piste**. Gestes et macros cohabitent sur la piste commune (§4) ; le non-chevauchement par piste suffit, aucune règle inter-pistes n'existe.

## 8. Le Builder — expansion

Le Principe A est **conservé tel quel** : les payloads vont dans `perso.actions`, les eventimes restent des déclencheurs purs `{name, startAt}`.

- Chaque posable (transition ponctuelle, bandeau, macro) est déplié par le Builder en **actions nommées déterministes** sur le perso avatar (noms dérivés de l'id du posable — ex. entrée/sortie d'un bandeau = deux actions) + les **eventimes purs** correspondants.
- Une transition ponctuelle produit une action + un eventime ; un bandeau au moins deux (entrée + retour à l'ambiant) ; une macro N (une par étape de phase).
- Le retour à l'ambiant d'un bandeau est **calculé au build** depuis le document (valeur d'escalier à `startMs + durationMs`, tempérament) et figé dans l'action de sortie — c'est ce qui rend l'ensemble seek-safe sans état runtime.
- **Multi-persos prêt par construction** : chaque perso avatar porte ses propres actions — le jour du dialogue (bien plus tard), le mécanisme ne change pas.
- Le tempérament se déplie en **config initiale** du perso (`mood`, paramètres idle), pas en événements.
- Préchargement : le GLB passe par la stratégie de preload de `createAvatar3DBinding`, à brancher sur le mécanisme de ressources d'ed2.

## 9. Pointer-vers-cible (IK) — niveau visé, pas v1

L'avatar-animateur désigne un item ou une zone de la scène, comme un professeur — le geste, banal pour un humain, doit cacher entièrement sa complexité. C'est **toute une gestuelle coordonnée** (buste, bras, main, tête, yeux, caméra), et l'un des rares moments où le **regard cesse d'être orienté vers le lecteur** — l'excursion type du canal regard (§3.1), avec retour au lecteur à la fin. **La désignation d'un item comme cible est calculable de bout en bout**, par une chaîne déterministe :

1. **Résolution de la cible au build** : le paramètre de macro est une référence (`itemId`/`zoneId`). Le Builder résout le **point d'ancrage de la cible en coordonnées normalisées de scène à l'instant du bandeau** — les décors/zones sont déclaratifs, la position à t est connue du document. Le point est **figé dans le payload** ; le runtime ne résout jamais une référence (seek-safe par construction).
2. **Passage en repère avatar au runtime** : le composant connaît son propre rect de scène (son canvas) → vecteur cible−avatar en espace scène, converti en coordonnées « écran virtuel » du canvas (valeurs hors [0,1] admises — la cible est hors canvas, c'est normal).
3. **Désprojection** : la caméra interne (fov/position connus) désprojette ce point écran en direction monde, intersectée avec le plan frontal de l'avatar → point de visée 3D. Mathématiques THREE standard, aucune dépendance nouvelle.
4. **Visée du bras** : pas une IK complète — une **contrainte d'orientation** (aim) sur la chaîne épaule-coude-poignet vers le point, coude légèrement fléchi, fusionnée avec la handshape pointée. Le `avatar-pose-composer` existant compose déjà des couches de pose : la visée est une couche de plus sur la chaîne du bras. (Une IK 2-bones analytique reste l'option si la contrainte simple ne suffit pas ; `CCDIKSolver` des exemples three.js en dernier recours.)
5. **Regard vers la même cible** : le `GazeService` ne vise aujourd'hui que la **caméra** — extension requise pour une direction arbitraire ; la machinerie (direction locale tête → morphs eyeLook + attention-bones pondérés sur le cou) existe et se réutilise telle quelle avec une autre direction d'entrée.
6. **Déterminisme** : la pose de visée est une fonction pure de (point figé, position dans la phase de la macro) — enveloppe entrée/tenue/sortie comme tout motion, rejouée à l'identique au seek.

**Raffinements naturels** (à la charge de la macro, invisibles pour l'auteur) : choix automatique du bras selon le côté de la cible ; rotation du buste si la cible est trop latérale (la phase « se tourner » de la macro) ; cible figée à l'instant de résolution en v1 (le suivi d'une cible mobile pendant la tenue est un raffinement ultérieur).

**Ce qui manque au moteur** : le solveur de visée du bras, l'extension regard-vers-direction, le mapping de coordonnées scène↔canvas. **Ce qui existe déjà** : composition de poses, attention-bones, retargeter, handshapes par template. Faisabilité : élevée ; la vraie difficulté est perceptuelle (que le geste *paraisse* naturel — enveloppes, léger overshoot), pas calculatoire.

## 10. Chantiers et ordre

Le gating « visèmes ⇒ avatar ajoutable » place le pipeline voix en tête.

| # | Chantier | Contenu | Dépend de |
|---|---|---|---|
| 0 | Spec détaillée du typeDef | forme exacte de `Item.avatar` (posables, tempérament, occurrences), naming des actions générées | ce document |
| 1 | Pipeline voix — grain visème | forced alignment à l'import du master, stockage `Content`, gating UI | — |
| 2 | Item avatar de bout en bout, nu | `ItemType` avatar, Builder → perso + idle + visèmes, préchargement GLB, tempérament (avec l'extension des fabriques idle) | 0, 1 |
| 3 | Pistes avatar dans le sequence-editor | volet repliable, renderer bandeaux/icônes, manipulation, non-chevauchement, aimantation aux cues | 2 |
| 4 | Macros | catalogue + expansion + occurrences + réglages UI + règle de collision | 3 |
| ∥ | Geste « pointer » | recherche d'une animation Mixamo adaptable, retarget, template — côté avatar3d, indépendant d'ed2 | — |
| ∥ | Customisation avancée | module dedit ; couleur/logo = R&D avatar-engine d'abord | 2 |
| v2 | Pointer-vers-cible | §9 : aim bras + regard-vers-direction + mapping coordonnées + résolution de référence au build | 4 |

Chaque chantier livre quelque chose de visible et vérifiable dans ed2 ; les démos révèlent les manques, elles ne les masquent pas.

## 11. Questions restées ouvertes

1. **Nommage technique** des actions générées et du grain visème dans `Content` (chantier 0). Les libellés UI, eux, sont tranchés : traductions des noms de gestes, JSON éditable (§4).
2. **Représentation des gestes à durée** : bandeau étirable, ou ponctuel + paramètre de vitesse (lent/rapide) — à trancher au chantier 3 (§4).
3. **Autorisation contractuelle** : forme du flag externe (hors périmètre, à raccorder le jour venu).

---

## Appendice — discussion de contexte (2026-07-16)

Trace de la discussion qui a produit ce document ; matière d'archive, non normative.

**Point de départ.** Le composant avatar3d (marionnette 3D de présentation : voix + visèmes + gestes + expressions + cadrage caméra) venait d'aboutir dans authoring, validé par `avatar-poc-1`. Question posée : comment l'utiliser dans ed2, sachant que sa surface d'API est importante, et que le public d'ed2 est **novice** — des utilisateurs qui ne veulent pas réfléchir longtemps à comment animer un personnage mais veulent un résultat précis.

**L'idée directrice : les macros.** Rapport entre informations précises et mise en œuvre simplifiée : d'un simple choix (sélectionner un keyframe, choisir la macro, quelques options), déclencher une séquence animée complète. Exemple canonique : *désigner du doigt* — le personnage se tourne, oriente son regard, effectue le geste, un certain temps, revient à sa position antérieure, pendant que la caméra fait un léger zoom arrière en décalant le personnage sur le côté. L'avatar devient **animateur** : à la façon d'un professeur, il peut désigner tel item qui apparaît simultanément dans la scène — d'où le pointer-vers-cible paramétré (la main dirigée vers une zone de la scène, comme une IK), dont la complexité doit être entièrement cachée.

**L'interface pressentie.** Des lignes d'édition proches de la piste son, qu'on découvre/masque d'un clic — un mode « édition avatar » du sequence-editor : piste mots (existante), pistes gestes, expressions, actions (macros), cadrage, à base d'icônes.

**Décisions prises au fil de la discussion :**
- l'avatar est un **item normal** ; conditions de présence : contrat (hors sujet), activation par création, **visèmes disponibles** comme gating, visibilité pour le rendu ;
- la **voix est indépendante** de la visibilité de l'avatar (masqué puis réapparaît, ou arrive après le début) ;
- **pas d'affichage des visèmes** (lipsync automatique) ;
- customisation dans **dedit, module distinct** (comme capsule ou media) ; capacités dépendantes du modèle choisi, hors sujet ;
- gestes/expressions/macros d'abord pensés comme **bandeaux à durée** (posés avec durée par défaut ; étendre, déplacer, effacer ; non-chevauchement par piste ; v1 mono-occurrence) — puis affiné : un geste peut aussi être une **transition ponctuelle sans durée** (« lever le bras » puis « baisser le bras »), et le **cadrage fonctionne pareil** (transitions à vitesse réglable) → d'où le modèle final escalier + excursions (§3) ;
- **payloads dans le perso** plutôt que sur les eventimes (le Builder le permet sans friction) — argument décisif : plusieurs persos un jour, chacun portant ses propres expressions (dialogue, bien plus tard) ;
- **tempérament** : humeur générale + niveau d'agitation, réglage simple pour toute la scène, « presque une macro » côté ed2 ;
- vocabulaire : **macro** en interne, **action** dans l'UI ;
- le geste « pointer » n'existe pas encore dans le catalogue (handshape RPM non résolue) ; la recherche d'une **animation Mixamo adaptable** est retenue, chantier parallèle côté avatar3d ;
- le pointer est **toute une gestuelle coordonnée**, et l'un des moments où le **regard quitte le lecteur** — d'où : le regard est un canal dont l'ambiant est le lecteur, sans piste propre, excursions par macro uniquement ;
- l'humeur d'ambiance peut aussi **se déduire du ton de la voix** (analyse à l'import) ou être **déclarée par la génération TTS** — l'avatar s'aligne automatiquement ; d'où le grain tonal (§6) et la préséance bandeau > ton > tempérament (§5) — **reporté hors périmètre** en fin de discussion.

**Arbitrages complémentaires (fin de discussion)** :
- **masquage ≠ bornes intro/outro** : le masquage exclut le personnage du rendu de la scène (il n'y existe plus) ; entre ses bornes intro/outro, le perso reçoit les visèmes en cours et joue son animation, hors écran compris ;
- **non-chevauchement garanti par la piste** : ce qui ne doit pas se toucher vit sur la même piste → **piste commune gestes/actions**, aucune règle de collision inter-pistes ;
- **durées par défaut** : déjà indiquées dans la définition du geste au catalogue, l'éditeur les montre ; simplification possible — gestes montrés ponctuels avec paramètre de vitesse (lent/rapide), plus intuitif pour l'auteur ;
- **libellés UI** : partir des traductions des noms de gestes, dans un JSON éditable plus tard.

**Conclusion de l'étude** : peu de frictions — l'API du composant est déjà événementielle et seek-safe, le modèle de document avait réservé le grain visème, le précédent capsule-automation donne le patron d'expansion. Faisabilité jugée bonne ; ce document en est l'outillage.
