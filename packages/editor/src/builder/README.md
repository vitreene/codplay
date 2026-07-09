# Le Builder ed2 — ce qu'il fait, et comment

`buildSceneDoc()` est le point d'entrée unique : il prend une `EditorScene` écrite par l'auteur (le modèle de données que produisent `sequence-editor`/`decor-editor`) et retourne un `SceneDef` Codplay prêt à compiler et jouer — plus le CSS dont la scène a besoin, sous forme d'une chaîne séparée (voir `styleSheet` plus bas).

## La forme d'une `EditorScene`

Une `EditorScene` est une durée de scène à plat (`durationMs`) plus un arbre de `TrackNode` (`scene.tracks`). Chaque `TrackNode` est de l'un des deux types suivants :

- `kind: 'element'` — un item feuille (aujourd'hui : `contentType: 'text'` uniquement, §5 du plan ; tout autre type de contenu lève une erreur plutôt que de retomber silencieusement sur autre chose — `mapContentTypeToPersoType`).
- `kind: 'capsule'` — un conteneur avec ses propres `children: TrackNode[]`, son propre `capsuleType` (`carousel`/`rangee`/`liste`/`grille`/`card`), et ses propres `keyframes` (quand elle apparaît/disparaît). Une capsule peut contenir d'autres capsules, à n'importe quelle profondeur — `capsule-a` contenant `capsule-b` contenant un item feuille est tout aussi valide qu'un seul niveau plat.

Chaque scène a aussi une capsule racine IMPLICITE que l'auteur ne voit ni n'écrit jamais directement (§6 de `2026-07-08-capsule-spec.md`) — c'est elle, le seul perso qui fait réellement le pont vers le `mountTarget` réel du player, et chaque track de premier niveau dans `scene.tracks` en est en réalité un enfant.

## Le pipeline, capsule par capsule

Chaque capsule (la racine implicite, ou toute capsule écrite par l'auteur) traverse exactement la même résolution en 3 étapes — `resolveCapsule()` est cette fonction unique, appelée une fois par niveau de capsule :

1. **Temporalité** — `CapsulePreset.resolve()` transforme le `capsuleType` d'une capsule + son réglage de distribution choisi par l'auteur (`sequential` ou `stagger`, `TrackNode.distribution`) en l'entrée concrète dont `CapsuleDistribution.compute()` a besoin. Seul `carousel` a une vraie valeur par défaut imposée par sa structure même (sa grille est forcée à une seule cellule, donc ses enfants DOIVENT se succéder) — tout autre type exige une `distribution` explicite, sinon le Builder lève une erreur plutôt que de deviner (Principe B). Ça donne à chaque enfant de la capsule son `{introMs, outroMs}` résolu — quand il apparaît/disparaît, relatif au début de la capsule elle-même.
2. **Grille, placement, transitions, CSS** — cette temporalité résolue alimente une vraie instance `AutoCapsule` (`capsule-automation`), qui résout la forme de la grille, le placement de chaque enfant (son propre placement explicite s'il en a un, ou la règle automatique du type — y compris le repli « zone fantôme » plein cadre pour les capsules de type `card`, généré automatiquement, sans aucun cas particulier à gérer ici), l'intro/outro de chaque enfant sous forme d'un diff de style concret (depuis la transition nommée de sa keyframe, ex. `fade`), et le CSS qui porte tout ça.
3. **Perso + eventimes** — l'artefact résolu devient un perso Codplay (toujours `type: 'list'`, quel que soit le sous-type propre de la capsule) avec un `className` portant les classes de grille/placement résolues, et quelques ACTIONS NOMMÉES (`${id}-intro`/`${id}-outro`) portant le diff de style résolu. Le tableau `story.eventimes` reçoit deux purs déclencheurs (`{name, startAt}`, aucune donnée) pointant vers ces mêmes noms d'action — c'est le Principe A : un eventime ne fait jamais que déclencher une action nommée, il ne porte jamais de donnée lui-même.

## Parcourir l'arbre

`buildSceneDoc()` ne parcourt pas `TrackNode.children` par récursion sur la pile d'appel — il fonctionne via une file d'attente plate (une queue) : résoudre les enfants d'une capsule, et pour chaque enfant qui est LUI-MÊME une capsule, empiler ses propres enfants sur cette même file pour être résolus ensuite. Rien dans le modèle propre de Codplay n'exige de récursion structurelle ici — le `move.parentId` d'un perso est une simple référence vers l'id d'un autre perso, peu importe la profondeur de l'arbre écrit par l'auteur — donc la file n'a besoin de retenir que des paires « ces tracks, sous cet id de perso parent ».

## Les deux sorties

- `sceneDoc` — le vrai `SceneDef`, construit via `SceneDocEditor` (l'aide à la construction de scène propre à Codplay), prêt pour `BuilderFacade.compile()`.
- `styleSheet` — le CSS résolu de chaque capsule, concaténé. Ce CSS n'est JAMAIS mis en ligne dans le `style` propre d'un perso — seulement référencé via `className` — il doit donc voyager jusqu'au player comme une vraie feuille de style (un Blob → `extraResources`, voir le câblage de la démo dans `packages/demos/src/codplay/ed2-builder-demo.ts`) pour que la scène s'affiche correctement.
