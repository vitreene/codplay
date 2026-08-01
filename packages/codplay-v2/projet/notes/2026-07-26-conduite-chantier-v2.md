# Conduite de chantier V2 — comment mener la réécriture

Note de réflexion (2026-07-26). Le document V2 (`2026-07-16-solve-project-moteur-custom.md`) dit **quoi
construire** ; celle-ci dit **comment le mener**. Aucun code — trace des principes de conduite décidés
en discussion. Périmètre codplay.

## 0. Principe d'audit directeur — traquer la « pièce rapportée » (invisible de l'extérieur)

**La synthèse de méthode qui gouverne la relecture du code V1.** Le défaut récurrent de la V1 n'est pas
comportemental — c'est **structurel et INVISIBLE de l'extérieur** : un dispositif **greffé faute de
place**, branché au mauvais endroit, qui *marche* (l'API et le comportement sont corrects) mais
contourne/duplique/se loge chez le voisin parce qu'un concept manque. Il faudra **repasser sur le code
V1 avec cette précaution de « pièce rapportée »** pour évaluer ce qui doit être revu — travail que
**seule une relecture structurelle** peut faire.

**Conséquence forte** : les **tests-oracle (§2) ne détecteront JAMAIS ces cas.** Un test comportemental
vérifie que la capture produit le bon résultat, pas qu'elle passe par le bon canal. `applyCaptureUpdate`
qui bypasse les transitions *marche* — aucun test ne dit « il ne devrait pas être là ». L'audit
structurel est donc **orthogonal** au filet de tests, pas couvert par lui.

**Grille de détection** (marqueurs d'une pièce rapportée, tous rencontrés en session) :
- un **bypass** explicite (ex. `applyCaptureUpdate` « bypassing run()/transitions ») ;
- un **appel nominal** là où le contrat veut du générique (`this.mediaSync.syncTimeline(...)`) ;
- un **canal parallèle** qui duplique un mécanisme (`capturePersoStatesMirror` re-simule le moteur) ;
- une **cicatrice de contournement** (parse contre `margin-left`, hack `"Npx"`, `stripIdentityTransforms`) ;
- un dispositif dans le **mauvais dossier** (`media-sync` sous `modules/` sans être un module) ;
- un **deuxième écrivain** pour un rôle qui devrait en avoir un (les deux `set`).

Toutes disent la même chose : **un concept manque → le dispositif s'est greffé sur le voisin.** Résorber
= poser le concept manquant (§4.4). C'est le fil rouge de tout ce document.

## 1. Décision cadre — réécriture franche, pas de cohabitation de runtimes

- **La V1 n'est PAS en production** (seules les démos l'utilisent). Aucune raison de la préserver
  vivante : on la **coupe pour la V2 quand elle est prête**. Pas de compromis pour faire cohabiter
  deux runtimes.
- **Le changement est CONCEPTUEL** (rejeu→évaluation, mutation→projection, impératif→déclaratif) — pas
  seulement quelques features en plus. Faire cohabiter V1 et V2 forcerait à conserver les concepts
  qu'on abandonne : le compromis tuerait l'intérêt.
- **L'interdit « big-bang » de `move-separation-policy` ne s'applique PAS ici** : il visait une
  migration in-place d'un système *en usage*. Une réécriture conceptuelle d'un système *non déployé*
  est un cas différent. (Ne pas re-invoquer cette règle hors de son domaine.)
- **La V1 a une structure conceptuelle solide et globalement réutilisable** (builder, track-manager,
  module-system sont sains) — c'est l'**implémentation** qui est à revoir (concepts entremêlés,
  fourre-tout, canaux parallèles). La V2 ne réinvente pas les concepts, elle fait **coïncider la
  structure du code avec les concepts**.
- **RÉÉCRITURE TOTALE — pas de ré-emprunts de code V1** (durci 2026-07-26). Appliquer les modèles
  cibles (FRP Behavior/Event, event-sourcing, scene-graph/dirty-flag — cf.
  `2026-07-26-ancrages-algorithmiques.md`) **suppose une réécriture totale** : ces modèles changent la
  **forme des types de base** (un `Behavior<T>` n'est pas une valeur ; un `project(log,t)` pur n'est
  pas un `applyStyleProps` mutatif). Réemprunter un module V1 (écrit en paradigme mutatif/impératif)
  serait exactement la **« pièce rapportée »** (§0) — un morceau au mauvais paradigme greffé sur le
  neuf, réintroduisant le défaut structurel que la V2 élimine. **Distinction nette** : « structure
  conceptuelle réutilisable » = les **specs, invariants, concepts** (le *quoi*) — PAS les
  **implémentations** (le *comment*). On garde : les specs V1 + les 69 tests comportementaux (oracle,
  §2). On réécrit : tout le code sous eux. Aucun fichier V1 n'est repris tel quel.

## 2. Le filet anti-régression — les tests V1 comme ORACLE, pas comme runtime parallèle

Le besoin réel de l'auteur pendant le dev : **maintien des features + prévention des régressions**.
Ce n'est PAS un besoin de cohabitation de code, c'est un besoin de filet de test.

- Les **69 fichiers de spec V1** décrivent le comportement observable (features, sémantique move,
  seek, straps). Ils sont la définition de « ce qui ne doit pas régresser ». La V2 se développe
  **contre cette suite**, au niveau **comportemental** (scène → état/DOM observable), pas au niveau des
  internes.
- **Tri à faire** : tests *comportementaux* (testent le *quoi* — passent sur V1 ET V2) vs tests
  *couplés aux internes V1* (testent `orderedChildIds`, la structure d'un rejeu, l'appel à anime —
  testent le *comment* abandonné, à réécrire).
- Là où la V2 change volontairement un comportement (améliorations fonctionnelles), le test est
  **amendé sciemment** — l'amendement EST la trace de la décision.
- **La V1 vit comme spécification exécutable de la V2, pas comme runtime parallèle.**
- **Limite à connaître** : les tests V1 sont un oracle de *comportement*, pas de *paradigme*. Un
  moteur peut passer tous les tests V1 (transitions correctes) tout en gardant un état interne
  seekable — donc rater l'exigence V2 (évaluation sans état porté, `f(t)`) sans qu'aucun test V1 ne le
  signale. **Ajouter des tests propres au paradigme V2** (ex. `solve` évaluable à `t` arbitraire sans
  état porté) que la V1 ne couvre pas.

## 3. Écrire le moteur « injecté en V1 d'abord » — ÉCARTÉ (retour d'expérience, pas spéculation)

Idée tentante : écrire le nouveau moteur d'interpolation, l'injecter dans la V1 via
`options.animationAdapter` (contrat déjà injectable), le valider contre les 69 tests avant d'écrire le
cœur V2. **Écartée.**

- **Raison non spéculative** : l'auteur a fait une approche similaire avec les interfaces de l'éditeur
  — des **couches parasites sont restées** à l'intégration à l'app. Le risque de contamination
  paradigmatique s'est déjà matérialisé une fois. On ne le rejoue pas.
- **Le plafond technique** confirme le risque : le contrat `AnimationAdapter` V1 encode le paradigme V1
  (`seek(t)` à état porté, `applyCaptureUpdate`/handles persistants, `run→AnimationHandle[]` mutables,
  `pause`/`resume`). Remplir ce contrat force à réintroduire l'impératif que la V2 abolit ; concevoir
  le moteur *contre* ce contrat coulerait des hypothèses V1 dans le solve → on produirait un
  « anime-bis » (paradigme V1 sans la dépendance npm), pas le `solve` V2.
- **Ce qui RESTE valable** : écrire le **noyau de calcul pur** (`solve(from,to,ease,t)→valeur`, courbes
  Penner, composition de tweens) comme **bibliothèque pure testée en isolation**, indépendante de tout
  contrat — réutilisable V1 et V2. Le noyau se conçoit depuis le modèle V2, jamais depuis le contrat
  V1. C'est l'enveloppe d'intégration qui est paradigme-spécifique, pas le noyau.

## 4. Principes de structuration — la structure dictée par les concepts, pas par l'accumulation

1. **Rôles distincts = dossiers distincts, fin du fourre-tout.** `create-player.ts` = 2980 lignes
   (seek/replay/tick/horizon/media/renderer mêlés). Les dossiers suivent le **flux S7** :
   `materialize` / `resolve` / `solve` / `project` — le concept dicte la structure, le fourre-tout
   éclate selon ces frontières.
2. **Injection unifiée.** Il existe aujourd'hui DEUX mécanismes non unifiés : `options.animationAdapter`
   (niveau player) et `host.registries.*` (niveau module). La V2 reformalise **un seul patron
   d'injection**, dont l'adapter d'animation, la Projection (S8) et les registries sont des instances.
3. **Module / service — DÉJÀ SPÉCIFIÉS, à respecter (pas un trou).** Voir `docs/formalisation/v1-module-api.md`
   et `v1-component-api.md`. Le modèle est posé et **déjà dans l'esprit V2** : le runtime **ne connaît
   pas le nom métier** d'un module — il annonce des **phases** (`beforeUpdate`/`afterUpdate`/
   `onComponentMounted`…) et un **dispatcher générique** exécute les modules dont le `match`
   (`actionKeys`/`componentCapabilities`) correspond ; le runtime reste un **routeur** (même
   philosophie que solve/project). **Séparation service/module spécifiée** : un `service` = capability
   locale de composant (`style`/`className`/`attr`/`content`), ne patche pas le runtime global ; un
   `module` = accroche runtime (+ face composant optionnelle), cas de référence `move`. La V2
   **applique** ce contrat, ne le réinvente pas. Réponse à « un module produit-il un solve ? » : oui,
   via un hook de phase, par dispatch générique — déjà le mécanisme. **Écart spec/impl déjà documenté**
   (v1-module-api § périmètre) : `move` est encore *inline* dans l'orchestrateur et **doit être
   extrait** vers son module — c'est ce que l'éclatement du fourre-tout (§4.1) réalise (acquis
   spécifié à faire, pas concept manquant).
   **Constat empirique (à auditer, 2026-07-26)** : le contrat a été écrit **pour `move`** (cas de
   référence spec), sans certitude qu'il *fasse modèle*. Vérifié : sur 6 dossiers `runtime/modules/`,
   **3 seulement suivent le contrat** (`move`/`list`/`replace` : `install`+`hooks`+`match`) ; **3 y
   échappent** (`media-sync`/`list-flip`/`list-dnd` : factories appelées **nominativement** —
   `this.mediaSync.syncTimeline(...)` dans `create-player`, exactement ce que la spec interdit). Ce sont
   des **dispositifs d'extension parallèles** — le système de modules n'est donc PAS le patron unique
   d'extension aujourd'hui. Le nom (« module » / « hook » / « service ») importe peu, à fixer en temps
   utile ; **ce qui compte = simplifier les canaux, éviter les concurrences**. Audit à mener, guidé par
   **« est-ce que cette feature est à sa place ? »** (question de *placement*, en amont de la
   conformité) : pour chaque dispositif hors contrat, dette à migrer, ou besoin non couvert exigeant
   d'enrichir le contrat, ou **sous-système mal rangé** qui n'est pas un module (intuition : `media-sync`
   = runtime à horloge/état, plus proche d'un sous-système que d'un hook). Résultat = décide si le
   contrat est *le* patron unique ou l'un de plusieurs. **Ne pas figer le contrat V2 avant cet audit.**
4. **Les dédoublements = concepts manquants**, pas des redondances à tolérer. Liste déjà repérée :
   canal parallèle `capturePersoStatesMirror` (→ étage solve manquant), deux `set` (`applyStyleProps`
   vs `utils.set` → étage project manquant), `applyStyleProps` vs `applyStylePatch`,
   `resolveContainerQueryValue` en 3 sites, câblage anime dupliqué, **3 modules hors contrat câblés
   nominativement** (§4.3). Résorber = poser le concept.
4bis. **Objectif premier de l'audit : simplifier les canaux, éliminer les concurrences.** Le nom des
   dispositifs (module/hook/service…) est **secondaire**, à fixer en temps utile. Ce qui prime = un
   canal par responsabilité, jamais deux mécanismes concurrents pour le même rôle (les dédoublements
   ci-dessus en sont la liste ouverte). **Grille d'audit du code actuel** : pour chaque feature,
   « **est-ce que cette feature est à sa place ?** » — question de *placement*, en amont de la
   conformité au contrat. Une feature peut être au bon endroit sous un mauvais contrat (migrer), au
   mauvais endroit (déplacer), ou en double (fusionner/supprimer). Cohérent avec le fil rouge V2 :
   **retirer plus qu'ajouter** — l'audit élimine des concurrences, il ne fait pas rentrer de force
   chaque feature dans un moule.
4ter. **Le flux CAPTURE — à penser dès le début (aujourd'hui greffé faute de place).** Constat vérifié :
   la capture est branchée sur le **canal d'animation** (`applyCaptureUpdate` est une méthode de
   `AnimationAdapter`) et **bypasse** explicitement `run()`/les transitions (`create-renderer.ts:411`
   « bypassing run()/transitions entirely ») — elle n'a rien à faire de l'interpolation, elle y est
   branchée faute d'un canal propre. C'est « il se greffe comme il peut à un runtime qui ne lui laisse
   pas de place ». **Ce qu'est la capture** : le geste **live** (drag/pointermove/dessin — édition OU
   interaction d'œuvre) capturé en **continu**, non interpolé (piloté de l'extérieur, sans courbe ni
   durée), produisant du **`persist-only`** (le visuel est déjà fait live → matérialisé, relu au seek),
   et notifiant l'éditeur (`onLiveCapture`). Écartelé entre runtime (écrire l'état) / matérialisation
   (persist-only) / authoring (notifier) → sans place. **Sa place en V2** : la capture est le
   **troisième producteur d'état perso** — solve produit l'état par *évaluation d'interpolation*, la
   capture par *pilotage externe live* (et le geste éditeur est peut-être la même chose : un geste live
   EST une capture). Deux/trois sources, **un** `PersoState`, **un** project. Elle **écrit l'état**,
   elle ne l'anime pas → cesse de bypasser l'animation. Sa sortie `persist-only` est déjà un citoyen de
   `f(t)` (valeur figée relue). Sa notification est le **canal authoring** (façade §6). **Point dur (=
   la remarque de l'auteur)** : prévoir la capture comme **écrivain de l'état perso dès la conception
   du `PersoState`** (plusieurs écrivains : solve + capture) — sinon elle se **re-greffera** comme
   aujourd'hui. Recoupe le geste live (doc principal S2/S6, « unifier offset/style sur le perso, un seul
   écrivain »).
5. **Auteur/diffusion = frontière conceptuelle → frontière de code** (voir §5).
6. **La compilation = lieu de résolution, le runtime = lieu d'évaluation.** Question ouverte : **la
   compilation peut-elle aller plus loin qu'aujourd'hui ?** Plus le build résout d'indétermination
   (fenêtres de validité, décors résolus, schedules aplatis), moins le runtime `f(t)` travaille. Axe à
   creuser, cohérent avec `f(t)`.
7. **La robustesse a un lieu — et ce n'est PAS le chemin chaud.** Trois responsabilités, trois lieux,
   jamais mélangées dans le player :
   - **Le player = le plus rapide possible → PAS de code défensif.** Chemin chaud (chaque frame,
     chaque `f(t)`). Toute garde défensive est un coût payé à chaque tick. Le player **fait confiance**
     à ses entrées, ne les revérifie pas.
   - **Le builder SANITISE.** Il a le droit d'être défensif : il tourne **une fois**, hors chemin
     chaud. Il valide/normalise/rejette le malformé, de sorte que le `CompiledScene` qui en sort est
     **garanti propre**. Patron classique : valider aux frontières (build), faire confiance à
     l'intérieur (runtime). Ajoute à §4.6 : le build est le lieu de résolution ET de validation.
   - **Un moteur de warning — distinct de la sanitisation, plus intentionnel qu'en V1.** La
     sanitisation *protège le runtime* ; le warning *aide l'auteur* à comprendre ce qui ne fonctionne
     pas dans sa scène (pas « rejeter » mais « expliquer »). Orienté compréhension auteur, pas trace
     technique. **Canal de sortie authoring** (façade §6) → présent dans le player de développement,
     **absent en diffusion** (scène validée, on ne re-diagnostique pas — cohérent §7 : la diffusion
     retire ce qui ne sert qu'à l'atelier).
   - **Critère de relecture du player** (comme la contrainte de portage) : une garde défensive dans le
     player est un *code smell* — soit le builder aurait dû la faire, soit c'est un warning mal placé.

## 5. Auteur / diffusion — la frontière (attention à l'interprétation)

**Distinction cadrée par l'auteur, à ne pas se tromper** :
- **Les interactions de l'ŒUVRE** (répondre à un quiz, dessiner, cliquer un élément interactif) **font
  partie de la scène** — un player de diffusion les respecte **pleinement**. Elles sont DANS le champ
  de la diffusion (le spectateur les vit ; elles matérialisent des events, résolvent l'indétermination,
  comme dans `f(t)`).
- **Les interactions d'ÉDITION** (manipuler un item dans l'éditeur, poser un keyframe, geste CS,
  capture) sont un dialogue *auteur↔outil*, hors du player de diffusion.
- La ligne n'est **pas** « interactif vs passif » — c'est **outil de création vs produit diffusable**.

**Player de diffusion autonome** : lit le `CompiledScene`, joue l'œuvre **avec toutes ses interactions
conçues par l'auteur**. En est exclu **l'outillage d'édition** (capture, keyframing, gestes d'atelier,
API auteur).

## 6. La façade multi-canaux — pensée depuis le début (l'authoring s'est formalisé trop tard en V1)

Constat V1 : `PlayerApi` est une **façade plate indifférenciée** — cycle de vie, pilotage (`seek`,
`setRate`), injection externe (`emit`), authoring (`getPersoStates`/`setNodePose`/`subscribeToNode`),
observation, **tout sur une interface**. L'authoring a été *greffé progressivement* dessus. La V2 le
pense **en canaux typés distincts dès le départ**, à **droit d'accès différencié** :

| Canal | Direction | Public | Accès |
|---|---|---|---|
| **Diffusion / telco** (pilotage) | ext → player | système de diffusion | transport seul (play/seek/rate) |
| **Injection externe** (events du dehors) | ext → scène | hôte applicatif | émettre dans la scène jouée |
| **Authoring** | player ↔ éditeur | outil de création | **méthodes internes** (capture/pose/état) |
| **Cycle de vie** | ext → player | intégrateur | init/destroy |
| **Observation** | player → ext | tous | état, traces |

**Le player est conçu pour être piloté.** « Piloté » = *pilotage de transport* (telco) + *injection
dans la scène* (events externes) — **sans** l'authoring. L'authoring est un canal à part, réservé à
l'éditeur.

**Cas d'usage révélateur** : un système de diffusion paramètre la scène dynamiquement selon des infos
reçues (profil, **nom d'un utilisateur réemployé dans la scène**). Il a besoin de **telco + injection
externe**, PAS de l'authoring (aucune raison de capturer une pose). Lui donner la façade complète
serait une fuite de surface. → la même scène compilée, le même moteur, mais **des façades différentes
selon qui pilote**.

## 7. Dev / diffusion / optimisation — le bon dosage

- **En développement : indistinct.** Un seul moteur, authoring inclus. On ne se complique pas avec
  deux builds pendant la construction.
- **En diffusion : un player orienté diffusion est pertinent, + un package scène associé** (lit le
  `CompiledScene` autonome).
- **L'optimisation** (bundle diffusion léger, authoring tree-shakable, surface réduite) est une
  **cible NON formalisée** — elle viendra plus tard, sur faits (poids mesuré, besoin d'intégrateur).
- **Seul impératif présent : l'architecture doit l'AUTORISER.** C'est une **contrainte négative** (ne
  pas entrelacer l'authoring dans le chemin de diffusion), pas un chantier positif (construire la
  séparation maintenant). Même discipline que la contrainte de portage : ne pas laisser l'authoring
  fuir dans le chemin de diffusion, comme on ne laisse pas la plateforme fuir dans le cœur.
- **Le choix surface-unique vs builds-séparés** se tranche **tard**, sur faits (sécurité de surface
  pour l'intégrateur, poids du bundle). La seule décision sûre à prendre tôt = **isoler l'authoring en
  canal propre**, ce qui garde les deux options ouvertes et corrige la greffe V1.

## 8. Rien en dur — toute convention et tout défaut en configuration centralisée

Principe auteur : **codplay est basé sur des conventions ; ne rien référencer en dur.**

- **Déjà à moitié fait, incohérent** : `runtime/config.ts` centralise les tokens move
  (`RUNTIME_CONFIG.move.rootToken` = `'@root'`, `detachToken` = `'@off'`), et TOUS les sites y
  réfèrent — patron prouvé. Mais **deux familles restent en dur** : les **noms d'events techniques
  réservés** (`'flip:play'`, `'track:activate'`, `'viewport:resize'`… strings éparpillées) et les
  **constantes de défaut** (`DEFAULT_DURATION_MS`, `DEFAULT_EASING`, `DEFAULT_STAGGER_MS`, seuils
  `1e-3`/`1e-8` — déclarées par fichier, dispersées globalement).
- **Principe V2** : toute **convention** (token, nom réservé, préfixe d'event) et tout **défaut** vit
  en config centralisée ; le code référence `CONFIG.x`, jamais la littérale. Le patron `config.ts`
  (prouvé sur move) devient **universel**.
- **Structuré par domaine** (dossier `config/` ou config par module composée), **PAS un fichier
  géant** — sinon on recrée le fourre-tout ailleurs. `RUNTIME_CONFIG` montre la voie (structuré
  `.move.rootToken`, pas plat). Respecte à la fois « rien en dur » et « rôles = dossiers distincts ».
- **Lien** : rien-en-dur = condition de l'**injection** (surcharger un défaut = fournir une config) ET
  du **portage** (les conventions de plateforme se déclarent en config, comme la Projection —
  `DomProjection` sa config, `FlutterProjection` la sienne).

## 9. Injection de librairies tierces — acquis à PRÉSERVER et vérifier

L'injection est un **système multi-entrées**, pas seulement l'adapter d'animation :
`animationAdapter`/`animeImplementation`, `components`, **`bindings` (`third-party-binding.ts` :
composants + renderAdapter tiers)**, `renderAdapters`, hooks (`onTimelineEvent`/`onRuntimeEmit`/
`onLiveCapture`), `runtimePolicy`/`createElementOptions`.

- **Les intégrations tierces existantes doivent continuer à fonctionner en V2** — acquis à préserver
  (`preserve-validated-acquis`), à **gate-tester**, pas à réinventer.
- **Distinguer deux niveaux** : le **mécanisme** d'injection (« je fournis mes composants/adapters à
  `create-player` ») doit **survivre tel quel** (contrat externe) ; le **contrat de ce qui est
  injecté** (forme du renderAdapter) **migre** avec la V2 (renderAdapter → Projection/`project`).
- **Question ouverte à vérifier (pas supposer)** : les intégrations tierces se re-câblent-elles
  automatiquement, ou demandent-elles une migration de leur contrat ? Documenter la migration
  éventuelle. **Ne pas casser silencieusement une intégration qui marche.**

## 10. Revue des entrées/sorties — ce qui est couvert, ce qui reste

Revue des canaux I/O réels de codplay confrontés au cahier des charges V2. **Leçon de méthode** : la
présence d'un canal I/O n'est PAS un manque ; seul l'est un canal dont le traitement *contredit* le
modèle V2. Lire avant de conclure (une déduction hâtive avait faussement listé le média comme trou).

**Déjà couverts** par les concepts V2 : `animationAdapter`/`animeImplementation` (moteur custom) ;
substrat/nodes (Projection) ; `components`/`bindings`/`renderAdapters` (injection tierce §9, Projection) ;
`emit` / authoring / telco / observation (façade multi-canaux §6) ; unités cqw + mesure (Projection,
`measure`).

**Les 5 canaux passés en revue** (verdict après lecture/clarification auteur) :

| # | Canal | Verdict |
|---|---|---|
| 1 | média / horloge | **Déjà résolu — acquis à PRÉSERVER.** `media-sync.ts` : master sélectionnable (`isMaster` + ordre de piste), sync par **correction de dérive** (`syncMasterToTimeline`, seuil 80ms) — la timeline reste maîtresse, le média est réaligné dessus ; `durationSource: 'audio-primary'` permet l'inverse (le master cale la scène). Le `MediaSyncRuntime` est **pur** (in-memory, déterministe, retourne des opérations). Vis-à-vis de `f(t)` : le média = **effet à side-effect corrigé** (case « irréductible filtré » déjà prévue), PAS une entrée temporelle qui casserait l'évaluation. C'est au temps ce que `measure` est à l'espace. La V2 préserve ce patron, ne le réinvente pas. |
| 2 | preload / injection CSS | **Cadré — capacité de Projection optionnelle.** Peu de mouvement V2 sur DOM ; l'éditeur préchargé de son côté ; important en diffusion mais **optionnel** (dégradation, pas échec). L'injection CSS (`document.head`) n'a de sens que là où on l'exploite → **capacité de Projection neutralisable** (`DomProjection` l'a, `FlutterProjection` = no-op). Même patron que `measure` optionnel. C'est une capacité *propre au substrat DOM* → confirme que le preload est une capacité de Projection, pas du cœur. **Deux modes de sélection de ressource** (nuances auteur, sans creuser) : (a) **déléguée / passive** — le substrat choisit nativement la variante selon le support (`<picture>`/`srcset`, `<source media=…>`, format/résolution) ; le preload DOM en tient compte, codplay n'intervient pas ; (b) **forcée par intention** — l'auteur/le système **impose** telle ressource plutôt qu'une autre **selon la plateforme**, car certaines qualités très spécifiques ne fonctionnent pas d'un navigateur/substrat à l'autre — court-circuite le choix natif. Le mode (b) s'appuie sur **la capacité de la Projection à détecter sa plateforme/ses limites** (quelles features supportées) + une **table d'intention `plateforme → ressource` en config** (§8, rien-en-dur). Délégation (le substrat choisit) vs intention (on impose contre le substrat). |
| 3 | viewport / resize | **À traiter — DANS la Projection (seul apport neuf).** Deux couches : (a) **passif** (cq*), privilégié, sans event — la Projection résout les unités adaptatives, tout l'enjeu de cq* ; (b) **actif** : les valeurs **unitless** resize-sensibles (une mesure px donnée unitless = de facto sensible, la forme porte la sensibilité, §8), recalculées **hors scale** au render. Modèle : cadre unitless fixe (ex. `160×90`), ratio calculé au lancement, resize = le `scale` bouge (pas le ratio), whitelist déclarée en config, **couverture partielle assumée** (jamais 100%, échec propre par scale global). Ratio + whitelist = **capacité de Projection**, à concevoir abstrait dès le départ (jamais câblé sur `ResizeObserver`). **Détail complet : `2026-07-26-unitless-resize-resolution.md`.** |
| 4 | hooks de sortie fine (`onTimelineEvent`/`onRuntimeEmit`/`onLiveCapture`) | **Vérifié : AUCUN consommateur externe aujourd'hui.** `onTimelineEvent`/`onRuntimeEmit` ne sont branchés par personne (ni démos, ni éditeur, ni tests) ; `onLiveCapture` n'a qu'un chemin interne (renderer→create-element). Ce sont des **points de sortie potentiels, posés en prévision, jamais exercés** — pas des canaux de debug avérés ni de production éprouvés. **Décision V2 : ne PAS les porter par défaut.** Les (re)créer dans le bon canal **quand un consommateur réel apparaît** — le canal se déduira de *qui* consomme (édition → authoring ; hôte de diffusion observant → observation ; système réagissant → interception), pas d'un choix a priori. Cohérent avec « ne pas reconduire une surface non exercée » / « inventaire, pas pari ». Intuition (non tranchée) : si un besoin ressurgit, probablement côté trace/inspection (debug/atelier). |
| 5 | telco comme transport réseau/distant | **Noté, HORS axe V2 actuel.** Très tentant (pilotage à distance, télécommande, multi-instances) mais éloigné pour le moment. Porte à ne pas condamner, pas un axe de développement. |

**Bilan** : aucun des 5 n'est un trou conceptuel. #1 déjà résolu, #2/#3 sont des capacités de
Projection (#3 apporte la convention unitless=resize-sensible + l'interception sélective), #4 se range
dans la façade, #5 est hors axe. La V2 (Projection + façade + config + f(t)) **absorbe** les 5 sans
nouveau concept — signe de complétude du cahier des charges.

## 11. La matrice des intentions — invariants directeurs

Les motifs qui se répètent d'un chantier à l'autre forment la **matrice des intentions** du projet. Leur
cohérence est ce qui le rend fiable : *on s'attend à ce que tel comportement donne ce résultat.* Ils se
lisent avec les ancrages algorithmiques (`2026-07-26-ancrages-algorithmiques.md`), qui disent à quels
modèles établis les processus se rattachent ; la matrice, elle, dit ce que la construction doit respecter.

**Force obligatoire.** Ces invariants **guident la construction**. Un endroit où l'implémentation risque
d'en contourner un **déclenche une analyse** — jamais un contournement silencieux. Une dérogation se
discute et s'écrit ; elle ne se constate pas après coup.

1. **Codplay fournit un défaut autonome et s'efface** devant un étage supérieur quand il existe (horloge,
   catalogue de capacités, stratégie de preload).
2. **Déclarer, jamais inférer** — et l'absence de déclaration échoue *avant lecture*, pas en jouant.
3. **Un canal par responsabilité** ; deux mécanismes concurrents signalent un concept manquant (§4.4).
4. **Catalogue déclaré / consommateurs qui revendiquent / arrangement au-dessus**, à chaque étage.
5. **L'exécutant ne décide pas, le décideur n'exécute pas.**
6. **Le ciblage vit un étage au-dessus de qui émet** — sinon l'autonomie du composant se perd.
7. **Un seul écrivain, un sens unique** (§4.4, S1).
8. **Sanitiser une fois hors chemin chaud, faire confiance ensuite** (§4.7).

**Corollaire de méthode** : un invariant non écrit n'est pas un invariant, c'est une habitude — et elle se
perd au moment même où le projet est réécrit. Tout invariant qui gouverne du code appartient à cette liste,
faute de quoi son infraction reste indétectable. Exemple d'invariant encore non écrit à ce jour : la règle
de mesure (styles calculés pour les dimensions, `getBoundingClientRect` confiné à l'ancrage).

## Statut

Principes de conduite actés. Aucun code. Questions ouvertes explicites : jusqu'où pousser la
compilation (§4.6) ; surface-unique vs builds-séparés (§7, tard) ; re-câblage des bindings tiers (§9).
(Module/service §4.3 n'est PAS une question ouverte : déjà spécifié — `v1-module-api`/`v1-component-api`
— la V2 applique. Hooks de sortie §10 #4 : décision = ne pas porter par défaut, recréer sur besoin
nommé.) Lié :
`2026-07-16-solve-project-moteur-custom.md` (quoi construire),
`2026-07-26-etat-fonction-de-t.md`, `2026-07-26-portabilite-contrainte-redaction.md`.
