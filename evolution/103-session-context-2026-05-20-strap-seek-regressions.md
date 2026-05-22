# Session context - 2026-05-20 - regressions straps / seek

## Objectif de cette note

Figer l'etat d'une session ou plusieurs correctifs successifs sur `seek`, telco, et straps ont fini par opacifier le diagnostic initial.

Cette note sert a une reprise ulterieure plus propre.

## Symptomes observes manuellement

1. `seek` devient moins previsible qu'avant sur `s4`
2. `intro` peut disparaitre ou ne pas rejouer correctement au retour arriere
3. le compteur strap n'est pas toujours reflecte correctement selon les seeks avant/arriere
4. la telco a subi plusieurs ajustements ergonomiques qui ajoutent de la complexite
5. la reactivite generale peut se degrader, signe possible d'accumulation de process / tracks helper / state reset mal cadres

## Constat important

Le modele `PlayerFacade` historique savait deja:

- reconstruire le runtime au `seek`
- rejouer les events timeline
- laisser `renderer.syncAnimationsToTimeline(...)` calculer l'etat intermediaire des transitions

La majorite des regressions recentes apparaissent dans la couche auteur ajoutee par-dessus:

- `Player.routeTimelineEvent(...)`
- execution de `listen/straps`
- generation de tracks helper runtime
- reset partiel de `story.state`
- dissociation `timelineEndMs` / `seekEndMs`
- ajustements telco sur click/drag du slider

## Dérives identifiées par rapport au modèle précédent

### 1. Les events timeline ne sont plus traités dans un flux unique et simple

Avant:

- `PlayerFacade.seek()` rejoue les events timeline directement

Apres refactor straps:

- les events timeline passent par `Player`
- puis redescendent vers `player.emit(...)`
- des gardes specifiques (`timelineReplayInProgress`, defer `sequence:end`, etc.) ont ete ajoutes

Effet:

- le chemin de replay n'est plus aussi lisible ni aussi proche du modele baseline

### 2. Les straps injectent des tracks helper runtime dediees

Conceptuellement, ces events sont de meme nature que des events user/system deferes, mais:

- ils sont aujourd'hui geres comme une mecanique supplementaire adjacente au `TrackManager`
- leur neutralisation repose sur `track:deactivate`
- leur cycle de vie pendant `seek` a force plusieurs contournements

Effet:

- l'introduction des tracks helper a pollue le raisonnement sur le seek, le progress, et l'etat story

### 3. Le role de `story.state` n'est pas encore correctement respecte

Le user a reprecise:

- le strap est stateless
- `story.state` est la memoire auteur
- le runtime ne doit pas y stocker sa mecanique interne

L'implementation actuelle s'en rapproche plus qu'avant, mais reste encore trop pilotee par:

- les tracks helper generees
- leur neutralisation technique

au lieu d'etre pilotee d'abord par la reconstruction auteur du `state`.

### 4. La telco a reçu des corrections ergonomiques avant stabilisation complète du moteur

Le slider a recu:

- separation `timelineEndMs` / `seekEndMs`
- gel temporaire d'echelle au `pointerdown`
- pause avant interaction

Ces corrections peuvent etre justes en UX, mais elles rendent le diagnostic moteur plus difficile tant que `seek` lui-meme n'est pas completement stabilise.

## Hypothèse de reprise la plus sûre

Partir du modèle `PlayerFacade` / `player-poc` qui fonctionne pour le replay/seek, et y rebrancher les effets dynamiques auteurs avec un principe simple:

1. les events dynamiques des straps sont de meme nature que les events user/system
2. ils doivent entrer dans le flux runtime canonique sans creer un deuxieme modele de replay
3. la couche auteur ne doit pas court-circuiter la reconstruction de `seek`
4. `story.state` doit etre reconstruit par le flux auteur, pas gere comme une memoire technique runtime

## Piste de simplification pour la reprise

Avant toute nouvelle correction, reevaluer la necessite de conserver tels quels ces ajouts:

- `timelineReplayInProgress` dans `src/player/create-player.ts`
- `generatedHelperTrackIds` dans `src/player/player.ts`
- `resetAuthorState()` / `captureInitialAuthorState()`
- `deactivateGeneratedHelperTracks()`
- la dissociation UX `timelineEndMs` / `seekEndMs` au niveau telco

Le but n'est pas de tout supprimer a l'aveugle, mais de verifier ce qui est:

- structurellement necessaire
- ou seulement un contournement d'une cause amont non reglee

## Zone moteur probablement saine

- interpolation des transitions par `renderer.syncAnimationsToTimeline(...)`
- media sync bas niveau corrige sur `seek/rewind`
- `TrackManager` comme source de verite temporelle

## Zone probablement en cause

- orchestration `Player` des events timeline + straps
- articulation entre:
  - replay timeline
  - generation de tracks helper
  - reconstruction de `story.state`

## Fichiers à relire en priorité pour la reprise

- `src/player/player.ts`
- `src/player/create-player.ts`
- `src/player/strap-types.ts`
- `src/demos/scenes/s4-quiz-reference-scene.ts`
- `src/demos/player/player-scene-demo/sequence-command-panel.ts`
- `src/demos/codplay/codplay-scene-demo/sequence-command-panel.ts`

## Décision de méthode

Pour la reprise:

- ne pas continuer a empiler des patchs locaux sur telco ou seek
- repartir d'un diagnostic comparatif explicite entre:
  - le replay `PlayerFacade` qui fonctionne
  - le replay `Player` + straps qui derive
- reintegrer les effets dynamiques auteurs selon un flux unique et lisible
