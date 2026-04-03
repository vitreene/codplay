# Plan consolide - modele scene event-driven

## Objectif

Poser un cadre unique et lisible pour:

- modeliser une scene independamment de la plateforme
- compiler la scene en objet lisible par le player
- executer un runtime deterministe pilote par events

Ce plan est la synthese evolutive du cadrage. Les notes detaillees peuvent continuer a exister pendant la phase de reflexion, puis etre consolidees ici.

Focus courant:

- priorite au modele Scene (structure, orchestration, invariants)
- sujets export/conversion traites plus tard

## 1) Perimetre global

Le systeme est compose de trois couches:

1. Scene model (auteur)
- document declaratif serialisable
- aucun code runtime embarque

2. Builder (compilation)
- transforme `SceneDoc` en `CompiledScene`
- resout structure, routage, temps, scenario, persos

3. Player (execution)
- consomme `CompiledScene`
- pilote events, scenario, medias, actions, rendu

Regle directrice: le builder compile, le player execute.

## 2) Scene model

`SceneDoc` assemble quatre plans:

1. contenu
- stories, persos, straps, medias

2. signal
- emissions et consommation d'events

3. temps
- groupes d'eventimes relies a des domaines temporels

4. scenario
- transitions narratives pilotees par events

La scene est aussi une unite d'orchestration reusable par un niveau superieur (ex: `Chapter`).

- elle doit exposer des entrees (events entrants + parametres)
- elle doit exposer des sorties (events scene)
- elle peut donc etre pilotee depuis l'exterieur et piloter une transition externe

Exemples d'entrees scene:

- `scene:start`
- `scene:param:set` (ex: score, mode, variante)

Exemples de sorties scene:

- `scene:end`
- `scene:request-next`

Vocabulaire scene I/O V1 (fige pour le cadrage):

- entrees:
  - `scene:start`
  - `scene:stop`
  - `scene:param:set`
  - `scene:param:patch`
- sorties:
  - `scene:ready`
  - `scene:end`
  - `scene:request-next`
  - `scene:error`

Note de cadrage (transition inter-scenes):

- le niveau `Chapter` n'est pas encore formalise
- la logique de transition inter-scenes est hors scope du modele Scene a ce stade
- aucune decision n'est prise ici sur l'emplacement de l'etat de transition
- ce choix dependra du projet auteur et sera traite plus tard

Note sur les parametres:

- les parametres (ex: `score`) sont portes par `scene:param:set` ou `scene:param:patch`
- la scene valide ces parametres via son schema d'entree avant application

Contexte utilisateur (hors SceneDoc):

- le contexte utilisateur n'est pas stocke dans la scene de construction
- il est fourni au runtime par le player ou l'environnement hote, apres compilation
- le player peut le projeter en params/events scene selon les besoins (ex: mode replay, score initial)

Conteneurs (distinction V1):

- conteneur host: element DOM fourni au player comme cible de montage
- conteneur scene: cadre racine interne ("stage") qui contient toute la scene active

Regles:

- le conteneur host est hors `SceneDoc` (decision d'integration)
- le stage est une structure runtime liee a la scene chargee
- pas de `container-id` dans le modele scene auteur
- le stage est scope scene (pas scope chapter/app en V1)
- un niveau superieur (chapter/app) peut encapsuler un ou plusieurs stages sans porter leur logique interne

Note de conception:

- le stage partage des similarites structurelles avec une story (hierarchie, contenu, style)
- en V1 il reste distinct conceptuellement d'une story narrative
- son cycle de vie depend du player/scene runtime, pas des transitions story

Invariants de base:

- IDs stables et uniques
- references resolvables
- separation stricte des semantiques contenu/signal/temps
- contrat d'entree/sortie scene explicite et stable

## 3) Story model (niveau general)

Une story est une unite d'orchestration locale.

- recoit des events du bus global
- normalise ses entrees via son ingress local
- expose un bus interne pour ses persos/straps
- emet des events sortants vers le bus global

Les persos restent reactifs via leurs actions par nom d'event.

Regle de possession des persos:

- un perso appartient a une seule story a la fois
- un perso ne peut pas etre reference simultanement par plusieurs stories
- un perso peut recevoir des events de sources multiples, sans changer sa story proprietaire

Regle straps (2 modes):

- strap global partage: meme instance et etat commun pour plusieurs stories
- strap local: copie par story (etat separe)
- le mode du strap doit etre explicite dans la definition scene
- reset par defaut du strap global partage: au `scene:start`


Decision V1:

- une scene peut avoir plusieurs stories actives en parallele
- ce mode multi-actif est le comportement nominal (pas une exception)

Implications:

- l'etat scene doit suivre un ensemble de stories actives, pas une story unique
- les transitions scenario peuvent activer/desactiver plusieurs stories
- les stories d'attente/overlay/interruption sont des cas natifs du modele

Politique scenario V1:

- comportement par defaut additif: une transition active ce qu'elle demande sans arreter implicitement les autres stories
- l'arret d'une story est explicite (commande/transition de type stop)
- une story peut aussi se terminer d'elle-meme et emettre son event de fin

Regle d'instanciation:

- instancier une story cree une copie logique complete de son contenu
- les persos d'instance sont des copies identiques, pas des references partagees
- deux instances d'une meme story ne partagent pas les memes IDs runtime de persos

Convention IDs runtime V1:

- `storyInstanceId`: `<storyId>#<n>` (n commence a 1)
- `persoRuntimeId`: `<storyInstanceId>/<persoId>`
- `strapRuntimeId` local: `<storyInstanceId>/<strapId>`
- `strapRuntimeId` global: `global/<strapId>`
- `mediaRuntimeId`: `<storyInstanceId>/<mediaId>`

Regles associees:

- les IDs auteur (`storyId`, `persoId`, `strapId`) restent inchanges dans la scene source
- les IDs runtime sont derives de facon deterministe pour faciliter traces et debug
- les compteurs d'instance sont reinitialises au `scene:start`

## 4) Event model

Tous les flux passent par une enveloppe event commune.

Natures d'events:

- utilisateur
- metier contenu
- temporel (issus d'eventimes)
- technique player/runtime
- orchestration externe (scene <-> parent orchestrateur)

Regles:

- matching exact des noms d'events
- ordonnancement deterministe
- tracabilite de la source et du contexte
- les signaux DOM globaux (`resize`, `orientation`) sont captes par le player, puis emis comme events techniques

Vocabulaire viewport technique V1 (fige):

- `viewport:resize`
- `viewport:orientation`
- `viewport:safe-area`

## 5) Eventime model

Un eventime est defini dans un domaine de temps local, pas en temps scene absolu.

Domaines cibles V1:

- media
- story (si expose)
- session

Regle de declenchement de base:

- un cue tire quand son `atMs` est franchi dans la fenetre de progression du domaine

Decision V1 (seek forward):

- un `seek` vers l'avant emet les cues franchis une fois

Decision V1 (rewind):

- un `rewind` rearme les cues eventimes pour un nouveau passage
- mode replay par defaut: `refaire`
- le mode effectif (`refaire`/`revoir`) est pilote par le contexte utilisateur

Decision V1 (loop):

- les cues eventimes se reemetent a chaque boucle

Modes replay:

- `refaire`: nouvelle execution interactive (events utilisateur non rejoues automatiquement)
- `revoir`: relecture avec events utilisateur enregistres (si disponibles)

Consequence:

- le moment session depend du moment de demarrage reel
- la synchro reste correcte en pause/reprise/seek (selon policies fixees)

## 6) Graph model

Le graphe scene utilise des liens types:

- `contentLink` pour la composition
- `signalLink` pour la propagation d'events
- `timeLink` pour relier eventimes et domaines

Le scenario reste un bloc dedie (projection visuelle possible) pour V1.

Validation attendue:

- compatibilite type de lien vs type de noeud
- detection de cycles non autorises dans le plan contenu
- detection des references manquantes

## 7) Builder boundary

Le builder doit etre separe en deux sous-couches:

1. Builder core (obligatoire)
- compile SceneDoc en CompiledScene portable
- construit les descripteurs de persos (pas les nodes)

2. Builder presentation (optionnel)
- derive artefacts de presentation (ex: CSS, tokens, classes)
- remplacable selon cible

Point cle:

- la generation presentation ne doit pas polluer le coeur narratif.

Le builder doit aussi permettre une sortie exportable et differee (creation -> diffusion):

1. export diffusion player

- package exploitable plus tard par le player
- inclut `CompiledScene` + dependances requises (medias, fontes, styles, librairies tierces)
- produit un manifeste de resolution des assets (integrite forte en phase diffusion)

2. export legacy

- transformation vers un format cible externe (ex: XML)
- destine a un autre contexte d'execution
- inclut un rapport de conversion (elements convertis, degrades, non supportes)

## 8) Perso boundary (scene vs plateforme)

La construction d'un perso est l'endroit le plus sensible du systeme, car elle touche a la fois:

- la logique scene (intention narrative, actions, etat initial)
- les contraintes plateforme (rendu, layout, perf, media backend)

Le cadrage retenu est une separation en deux etapes de compilation avant execution:

1. Construction logique (builder core)

- lit la scene et produit une definition portable du perso
- conserve uniquement des intentions (etat, actions, transitions attendues)
- ne choisit pas de primitive de rendu concrete

2. Adaptation plateforme (builder platform)

- prend la definition logique + profil de capacites de la plateforme
- transforme les intentions en plan concret executable
- applique des fallbacks explicites quand une capacite manque

Le player execute ensuite ce plan concret, sans redecider l'architecture du perso.

Risque a eviter:

- coupler trop tot la scene au web (DOM/CSS) ou a une cible unique
- faire porter au player des decisions de compilation qui doivent rester en amont

Regle directrice:

- la scene decrit "quoi faire"
- la couche plateforme decide "comment le faire"
- le player se concentre sur "quand l'executer"

Exemple directeur:

- intention scene: deplacement anime
- adaptation plateforme: FLIP si disponible, sinon transform, sinon fallback degrade trace

## 8.b) Modules perso custom (plugin API)

Reference detaillee V1:

- `09-perso-custom-actions-v1.md`

Objectif:

- permettre des types de persos custom sans modifier le coeur du player
- garder un noyau standard (text/img/list) + extensions chargees par module

Principe general:

- un item de story declare son `type`
- si le type est standard, le player utilise `create-element` standard
- si le type est custom (ex: `avatar`), le player delegue a un module enregistre

Cycle d'integration module:

1. detection

- au `load`, le player identifie les types custom utilises par la scene

2. resolution registry

- chaque type custom doit correspondre a un module present dans le registry player
- si un module manque: le perso est ignore + warning runtime

3. preload

- le module peut charger ses ressources/SDK avant `start`
- cette phase est asynchrone

Resolution registry (decision V1):

- table hote fournie au demarrage: complete la table interne
- override autorise par meme nom de type
- un seul module final par type
- registry fige pendant la scene
- modules integres: toujours montes
- en mode debug: exposer types detectes, module choisi par type, persos ignores

4. instanciation

- a la creation runtime des persos, le module produit un noeud racine via `render()`
- le module peut exposer une logique d'interaction propre

5. actions

- les actions de story restent declenchees par events
- l'interpretation des commandes custom est faite par le module cible

6. teardown

- au `stop/destroy`, le module libere ses ressources runtime

Contrat minimal d'un module (V1):

- `moduleId`
- `itemType` supporte (ex: `avatar`)
- `preload(context)` optionnel (async)
- `init(initInput)` optionnel
- `start()` optionnel
- `update(updateInput)` obligatoire
- `render(renderInput)` obligatoire (retourne le noeud racine du module)
- `destroy(context)` optionnel
- `emit(event)` injecte par le player

Niveaux d'action (V1):

- niveau player: actions standard sur le noeud racine (move/style/attr/size)
- niveau module: orchestration interne (canvas, svg, sous-noeuds) via `update()`
- un perso custom peut piloter plusieurs updates internes sans bijection 1:1 perso->node interne

Modes de routage d'action (V1):

- `root-only`: le player agit sur le noeud racine uniquement (cas avatar/canvas)
- `exposed-targets`: le module expose des cibles internes adressables (ex: `root`, `svg`, `glyph-12`)
- dans `exposed-targets`, le player peut appliquer ses actions standard sur chaque cible exposee

Decision V1 (forme module):

- une instance de classe par perso runtime (etat local isole)
- le registry associe `item.type` -> classe module

Format de donnees recommande pour les stories:

- `item.type` selectionne le module (`avatar`, etc.)
- configuration initiale module dans `item.module` (objet libre)
- actions module via `actions[eventName].cmd`
- le schema exact est defini par le module, pas par le coeur scene

Contrainte V1 de verbosite:

- `cmd` porte directement ses champs metier (pas de conteneur `payload`/`args` systematique)
- exemple: `{ name: "set-mood", mood: "happy" }`

Passage action -> module (V1):

- un event story declenche une action item
- si `cmd` existe, le player appelle `module.update({ command: cmd })`
- le module peut publier un event via le callback `emit()` injecte
- si la commande module est refusee, la partie visuelle standard continue

Passage action -> noeud cible (V1):

- si `targetId` vise le perso racine: application player sur le noeud racine
- `targetId=root` peut etre resolu directement par le player
- si `targetId` vise une cible exposee par module: application player sur cette cible interne
- si la cible n'existe pas: patch standard ignore + warning runtime
- en mode `root-only`, un `targetId` different de `root` est ignore + warning runtime
- la resolution de cible est refaite a chaque action

Cas avatar (exemple):

- `render()` retourne un `canvas` (noeud racine)
- le player peut deplacer/redimensionner ce canvas
- le rendu 3D interne du canvas est gere par le module (pas par le player)

Cas div+svg (micro-animations):

- `render()` retourne une `div` racine contenant un `svg`
- le module expose `div` et `svg` (et eventuellement des sous-noeuds) comme cibles adressables
- le player peut piloter les transitions standard sur ces cibles
- le module orchestre les enchainements internes et leurs contraintes

Events techniques vers module:

- par defaut le module recoit ses actions
- certains events techniques cibles (`viewport:*`) peuvent etre routes vers le module
- ces events ne remplacent pas les actions de scene
- ils ne changent pas l'ordre `cmd -> cible -> patch standard`

Portee scenario/story:

- les stories utilisent les types custom comme n'importe quel type de perso
- le scenario ne connait pas l'implementation du module
- le module est une capacite player, pas un concept narratif

## 9) Runtime contract

Entree runtime:

- `CompiledScene`
- events/params entrants depuis l'orchestrateur parent

Cycle runtime:

1. ingestion des events
2. production d'events temporels (scheduler)
3. ordonnancement deterministic
4. resolution actions + transitions scenario
5. application et commit rendu
6. trace

Sorties runtime:

- events scene emis vers l'orchestrateur parent
- etat scene observable (si expose par policy)

Etat scene attendu (minimum):

- liste des stories actives
- node scenario courant
- contexte scene courant (parametres/runtime data)
- map des instances actives avec leurs persos propres

Le player ne doit pas recompiler en boucle la scene auteur.

## 10) Adaptateur temporaire

L'adaptateur de compatibilite est hors coeur.

- usage: exemples/tests de conception (hors smoke)
- pas de dependance structurelle du runtime cible

## 11) Decisions deja stables

- architecture event-driven
- temporalite exprimee via domaines + scheduler
- separation builder vs player
- separation scene portable vs implementation plateforme
- contrat API host minimale V1 formalise
- mapping RuntimeContext -> scene.params.runtime formalise
- consolidation documentaire autour de ce plan

## 12) Points a figer ensuite

1. format des diagnostics compilation/execution
2. contrat scene I/O pour orchestration parent (entrees/sorties/parametres)
3. extension du contrat modules perso custom (au-dela du V1 deja fixe)
4. format des exports builder (player package, legacy artifact)

Priorite de cadrage immediate:

- points 1, 2, 3
- point 4 reporte hors scope court terme

Mini-spec `RuntimeContext` V1:

Reference detaillee V1:

- `11-runtime-context-mapping-v1.md`

- `replayMode`: `refaire | revoir`
- `locale` (optionnel)
- `sessionKind`: `live | replay` (optionnel)
- `inputProfile`: `web | mobile | kiosk` (optionnel)
- `seed` (optionnel, determinisme)

Regles V1:

- `RuntimeContext` est fourni par le player/environnement apres compilation
- il n'est ni stocke dans `SceneDoc`, ni persiste dans `CompiledScene`
- champs absents: defaults runtime appliques (`replayMode=refaire`)
- champs inconnus: ignores par defaut (trace debug possible)

Mapping V1 vers la scene:

- le player derive un `initialSceneParams` depuis `RuntimeContext`
- le player publie ces parametres via `scene:param:set` avant `scene:start`
- la scene valide ces params avec son schema d'entree

Catalogue mapping V1 (minimal):

- `RuntimeContext.replayMode` -> `scene.params.runtime.replayMode`
- `RuntimeContext.locale` -> `scene.params.runtime.locale`
- `RuntimeContext.sessionKind` -> `scene.params.runtime.sessionKind`
- `RuntimeContext.inputProfile` -> `scene.params.runtime.inputProfile`
- `RuntimeContext.seed` -> `scene.params.runtime.seed`

Regles V1 de mapping:

- les cles non mappees sont ignorees par defaut
- toute cle mappee mais invalide produit un diagnostic runtime
- les updates en cours de scene passent par `scene:param:patch`

Pendant le cadrage, ces points peuvent etre explores dans plusieurs notes.
La version finale doit ensuite etre consolidee proprement dans ce plan.

## 13) CompiledScene minimal V1

Objectif:

- figer la forme minimale de l'objet compile consomme par le player
- garantir un chargement differe hors contexte de creation

Blocs minimaux attendus:

1. manifeste

- `schemaVersion`
- `sceneId`
- `compiledAt`

2. contrat scene I/O compile

- `inputs`
- `outputs`
- schema parametres d'entree (si present)

3. registres compiles

- stories
- persos
- straps (avec mode explicite global/local)
- medias
- eventimeGroups

3.b exigences modules

- liste des `item.type` custom detectes
- mapping type custom -> module attendu

4. plans de routage

- composition (`contentLinks` resolves)
- signal (`signalLinks` resolves)
- temps (`timeLinks` resolves)

5. scenario compile

- `initialNodeId`
- noeuds et transitions deja triees
- commandes scenario explicites (start/stop/add)

6. plan d'instanciation

- convention IDs runtime (`storyInstanceId`, `persoRuntimeId`, `strapRuntimeId`)
- policy compteur (`reset au scene:start`)
- ownership persos (exclusif story/instance)

7. defaults runtime

- politique multi-stories additives
- parametres scene initiaux (si definis)

8. descripteur de stage runtime

- definition du cadre racine interne de scene
- distinct des stories narratives

Note:

- `CompiledScene` ne contient pas les valeurs de contexte utilisateur
- il contient le contrat d'entree necessaire a leur application au runtime

Invariants `CompiledScene`:

- aucune reference pendante (tout ID resolu)
- aucun perso partage entre stories/instances
- mode de strap explicite pour chaque strap
- derivation d'IDs runtime deterministe

Non-objectifs `CompiledScene`:

- pas de node concret de rendu
- pas de state runtime mutable
- pas de logique de tick embarquee

## 14) API host minimale V1

Reference detaillee V1:

- `10-api-host-v1.md`

Objectif:

- fournir une surface de pilotage simple pour charger, lancer et observer une scene
- garder la meme API entre mode player et mode debug

Regles V1:

- commandes de base:
  - `load(compiledScene, mountTarget, runtimeContext?)`
  - `start()`
  - `stop(reason?)`
  - `emit(event)`
  - `setSceneParams(params)`
  - `patchSceneParams(patch)`
  - `dispatchTechnicalEvent(event)`
  - `getState()`
  - `subscribeTrace(listener)`
  - `subscribeWarning(listener)`
  - `destroy()`
- `start()` sans `load()` est invalide
- `RuntimeContext` peut etre fourni a `load()` puis ajuste via params/events
- `emit()` est deterministicement ordonne avec les autres sources runtime
- `ModuleRegistry` est resolu au `load()`
- type de perso inconnu: perso ignore + warning
- `destroy()` idempotent

## 15) Exports builder - baseline V1

Sans figer encore le format final, on pose une baseline minimale.

1. Export diffusion player (`PlayerExportPackage`)

Objectif:

- transporter un resultat de compilation exploitable plus tard, hors contexte de creation

Contenu minimal attendu:

- `compiled-scene` (artefact principal)
- index des assets (medias, fontes, styles, tiers)
- manifeste d'export
- metadata de build (version schema, date, cible runtime)

Capacites attendues:

- resolution deterministe des assets
- compatibilite mode offline/online selon policy d'export

Position de phase:

- phase actuelle (debug conversion): priorite a la lisibilite des logs/rapports
- phase diffusion (ulterieure): durcissement integrite (hash/signature) a ajouter

Decision V1 (phase debug):

- mode par defaut: bundle complet autonome
- versionnement: schema semver explicite dans le manifeste
- resolution assets par defaut: offline-first (depuis le package)
- integrite forte (hash/signature): reportee a la phase diffusion

2. Export legacy (`LegacyExportArtifact`)

Objectif:

- projeter la scene vers un format d'execution externe (ex: XML)

Contenu minimal attendu:

- artefact converti (ex: `scene.xml`)
- rapport de conversion machine-readable
- journal des degradations/non-supports

Regles:

- la conversion legacy n'influence pas le modele coeur
- toute perte de semantics doit etre explicite dans le rapport

Decision V1:

- en cas de non support: degradation + rapport (pas de blocage global par defaut)
- mode strict optionnel: fail-fast activable par option d'export

3. Rapport de conversion (minimum commun)

Le rapport doit au minimum exposer:

- nombre d'elements convertis
- nombre d'elements degrades
- nombre d'elements rejetes
- liste des codes de diagnostic

Systeme de warning adapte au debug (V1):

- un flux detaille `conversion-log.ndjson` (une ligne = un evenement de conversion)
- un resume `conversion-report.json` (compteurs, severites, top codes)
- une table de mapping `conversion-map.json` (id source -> id cible)
- un extrait humain `conversion-report.md` pour lecture rapide

Decisions debug V1:

- verbosite par defaut: `trace + info + warn` (avec `error`/`fatal` implicites)
- granularite mapping par defaut: niveau element (pas niveau champ)
- rapports/logs inclus dans l'artefact exporte

Severites recommandees:

- `trace`: etape technique detaillee
- `info`: conversion nominale
- `warn`: conversion avec degradation/fallback
- `error`: element non converti, export global continue
- `fatal`: export interrompu

Codes de warning:

- tous les warnings/errors/fatals doivent avoir un code stable
- categorie proposee: `LEGACY_PARSE_*`, `LEGACY_MAP_*`, `LEGACY_UNSUPPORTED_*`, `LEGACY_OUTPUT_*`

Politique d'arret par defaut (debug):

- continuer tant qu'il n'y a pas de `fatal`
- accumuler un maximum de diagnostics utiles en un seul run

4. Position architecture

- ces exports font partie du builder
- ils sont detaches du player runtime
- ils reutilisent `CompiledScene` comme source de verite compilee

## 16) Points encore ouverts sur les exports

1. format exact du manifeste player package (champs obligatoires)
2. format exact du rapport de conversion legacy (codes + severite + mapping)
3. checklist de passage phase debug -> phase diffusion (integrite, signatures, policy CI)

Note cadrage:

- le detail des champs du manifeste player est volontairement reporte
