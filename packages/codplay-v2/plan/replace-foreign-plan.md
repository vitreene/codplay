# CodPlay V2 - remplacement d'une scène foreign dans un layout

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Decision de direction: validee le 2026-08-24  
Implementation: non commencee

Ce plan complete la capacite V2 `replace`. Il ne modifie pas le contrat des
remplacements de texte, d'image ou de media. Il décrit le cas où Sighty pilote
une scène enfant montée dans un slot d'un `LayoutComponent` et demande son
remplacement visuel par une autre scène.

## 1. Objet

Sighty possède les instances de scènes et leur cycle de vie. CodPlay possède la
projection HTML du layout et l'opération visuelle de remplacement. Le composant
parent ne connaît pas le contenu de la scène enfant : il connaît uniquement le
conteneur et ses cibles déclarées.

```text
Sighty
  -> prépare, met à jour ou arrête une scène enfant
  -> envoie une intention au layout hôte
  -> LayoutComponent résout le slot cible
  -> replace-foreign monte et anime la représentation HTML
  -> Sighty reçoit la fin et décide du teardown de l'ancienne scène
```

Cette capacité est une opération de projection déclenchée par event. Ce n'est
pas une nouvelle forme de `SceneDoc`, un second player ou un canal direct entre
deux scènes.

## 2. Frontière et responsabilités

| Responsable | Responsabilité | Interdit |
|---|---|---|
| Sighty | possède les players enfants, choisit la scène active, prépare le prochain objet, décide du mount/unmount et du destroy | laisser le layout inventer une scène ou une destination |
| Event bridge | adresse l'opération au layout et transporte la référence de l'objet foreign | injecter un node dans `CompiledScene` |
| `LayoutComponent` | expose les slots et applique l'opération au conteneur ciblé | inspecter la structure ou l'état de la scène enfant |
| `replace-foreign` | conserve une représentation sortante, monte l'entrante, joue la transition et nettoie ses clones | détruire le player enfant ou appliquer un split |
| HTML materializer | résout les nodes réels, mesure et crée les ressources transitoires | publier les clones comme parts ou cibles de placement |
| scène enfant | continue de recevoir ses events et son temps propres | connaître le layout hôte ou nommer sa cible |

Le remplacement ne transfère donc pas la propriété de la scène. Il transfère
temporairement la propriété de la représentation de transition au materializer.

## 3. Objet foreign runtime

La première tranche vise un objet foreign HTML représentant les racines
materialisées d'une scène enfant :

```ts
type ForeignSceneObject = Readonly<{
  kind: 'foreign-scene'
  sceneInstanceId: string
  roots: readonly HTMLElement[]
}>
```

Cette forme est un contrat runtime de la frontière Sighty/HTML. Elle n'est pas
acceptée comme donnée auteur dans `SceneDoc` ou `CompiledScene`. Les racines
restent possédées par le player enfant et ne deviennent pas l'état logique du
layout.

L'event peut transporter l'objet dans le processus local. Pour le journal, le
replay et le seek, la valeur doit être normalisée en une référence stable
(`sceneInstanceId`) puis résolue par le registre runtime de Sighty. Le journal ne
doit jamais sérialiser le node HTML lui-même.

Les racines entrantes sont montées directement dans le slot, dans leur ordre,
selon la règle de fragment déjà portée par le materializer HTML. Le
`replace-foreign` ne crée pas de wrapper auteur pour cette représentation.

La difficulté du multi-racines se limite au clone sortant. Le materializer crée
alors un wrapper technique temporaire dans l'espace du slot, y place les clones
des racines sortantes et anime ce groupe comme une seule représentation. Ce
wrapper n'est ni une racine de scène, ni un perso, ni une cible de placement ;
il est supprimé à la finalisation ou à l'annulation.

Les racines doivent appartenir au même slot et pouvoir être mesurées dans un
même espace de présentation. Des racines réparties entre plusieurs hôtes ne
constituent pas une seule opération `replace-foreign`.

## 4. Opérations adressées au layout

Le vocabulaire d'opérations est le suivant :

```ts
type LayoutSceneOperation =
  | {
      type: 'mount'
      target: string
      scene: ForeignSceneObject
    }
  | {
      type: 'update'
      target: string
      sceneInstanceId: string
      event: { name: string; data?: Record<string, unknown> }
    }
  | {
      type: 'unmount'
      target: string
      sceneInstanceId: string
    }
  | {
      type: 'replace'
      target: string
      previousSceneInstanceId?: string
      nextScene: ForeignSceneObject
      transition: { name: string; durationMs?: number }
    }
```

Les noms exacts des events restent à aligner avec la surface publique de Sighty.
La sémantique est fixée : Sighty adresse une intention, le layout applique une
opération sur un slot, et `replace-foreign` ne prend en charge que la branche
`replace`.

Un `update` sur une scène déjà montée ne rerend pas le layout et ne remplace pas
son node. Il relaie l'event à l'instance enfant identifiée. Un `mount` sans
contenu actif remplace une opération de replace sans transition. Un `unmount`
retire la représentation, mais le destroy de l'instance reste une décision de
Sighty.

## 5. Intégration avec le pipeline event

Le chemin attendu est :

```text
event externe Sighty
  -> bridge de visibilité/injection
  -> event ciblé sur le perso layout
  -> action ou capability de layout
  -> opération LayoutSceneOperation
  -> materializer HTML / replace-foreign
```

L'event de remplacement est un fait discret. Il est journalisé avec son temps,
sa cible, l'identité de la scène précédente, l'identité de la scène suivante et
la transition déclarée. Le node foreign est une résolution runtime attachée à ce
fait, pas le fait lui-même.

Le layout ne doit pas traiter cet event comme une mise à jour ordinaire de
`content` lorsque cela ferait perdre l'identité de la scène, son ownership ou sa
fin de transition. Le service `content` reste adapté au contenu élémentaire ; la
capacité de slot foreign porte l'opération de scène.

## 6. Variante `replace-foreign`

`replace-foreign` est une variante du module `replace` sélectionnée lorsque la
cible est un slot de scène et que la nouvelle valeur est un
`ForeignSceneObject`.

Elle accepte uniquement des transitions de représentation compatibles avec un
contenu opaque :

- fondu entrant/sortant en première implémentation ;
- éventuellement translation ou combinaison de propriétés du conteneur après
  validation dédiée ;
- aucun split texte ;
- aucun split en cellules ;
- aucune lecture de l'arbre interne de la scène enfant ;
- aucune modification des persos de la scène enfant.

La déclaration de transition reste sérialisable :

```ts
{
  replace: {
    kind: 'foreign-scene',
    transition: 'fade',
    durationMs: 300
  }
}
```

L'objet `ForeignSceneObject` arrive au runtime par l'opération Sighty. Il ne
figure pas dans cette déclaration.

## 7. Cycle d'un remplacement

### 7.1 Préparation

1. Résoudre le slot déclaré du layout.
2. Vérifier que la scène suivante est prête et que ses roots sont utilisables.
3. Capturer la représentation actuelle du slot avant toute mutation.
4. Créer un wrapper technique temporaire pour le groupe sortant.
5. Cloner chaque racine sortante dans ce wrapper en conservant son ordre et sa
   géométrie relative au slot.
6. Conserver l'identité de l'ancienne scène pour le signal de fin.

Le wrapper et ses clones sont des ressources de transition. Ils ne reçoivent
aucun ID de perso, aucun `data-part`, aucune inscription de markup et aucune
cible de placement. La géométrie des clones est capturée avant la mutation ; le
materializer ne dépend pas d'un nouveau calcul de layout produit par le clone.

### 7.2 Montage et animation

1. Monter les racines de la scène suivante dans le slot, dans leur ordre.
2. Placer le wrapper sortant et les racines entrantes dans la même zone visuelle.
3. Masquer ou retirer la représentation sortante originale selon le protocole
   de mount fourni par Sighty.
4. Jouer l'outro du wrapper sortant et l'intro des racines entrantes avec la
   même fenêtre temporelle.
5. Maintenir l'ancienne instance de scène sous le contrôle de Sighty jusqu'à la
   fin de l'opération.

Le layout ne connaît ni le contenu des clones ni celui des racines entrantes. Il
fournit seulement le conteneur et la cible de montage. Le materializer peut
appliquer la même progression à chaque racine entrante sans leur imposer un
wrapper persistant.

### 7.3 Finalisation

1. Supprimer le wrapper et tous ses clones temporaires.
2. Restaurer la visibilité et les styles transitoires du slot.
3. Déclarer les roots entrants comme représentation active.
4. Émettre un event technique de fin avec les deux identités de scène.
5. Sighty peut alors démonter et détruire l'ancienne scène selon sa politique.

Le module `replace-foreign` ne détruit jamais l'ancienne scène directement.

## 8. Etats et interruptions

La capacité possède au minimum les états suivants :

```text
idle
  -> prepared
  -> outgoing-captured
  -> incoming-mounted
  -> transitioning
  -> completed

prepared / outgoing-captured / incoming-mounted / transitioning
  -> cancelled
```

Une nouvelle demande sur le même slot pendant `transitioning` doit suivre une
politique explicite : annulation et remplacement de la transition en cours,
attente, ou rejet diagnostiqué. Aucun empilement implicite de clones ne doit
être introduit.

Une annulation nettoie toujours les clones et les styles transitoires. Elle ne
détruit ni la scène précédente ni la scène suivante ; Sighty décide ensuite
laquelle reste active et laquelle est démontée.

## 9. Seek et replay

Le remplacement est un fait daté du journal du player hôte. Le seek ne rejoue
pas l'event ni les callbacks Sighty ; il reconstruit l'état du slot et évalue la
frame de transition à l'instant demandé.

- avant l'event : l'ancienne représentation est active ;
- pendant la fenêtre : le clone sortant et la représentation entrante sont
  présents selon la progression de la transition ;
- après la fenêtre : seule la représentation entrante est active ;
- le clone n'existe jamais comme materialisation persistante.

Pour un seek, le registre Sighty doit pouvoir résoudre les deux références de
scène nécessaires. Si l'objet foreign n'est plus disponible, le materializer
retourne un diagnostic déterministe et n'invente pas de node de remplacement.

Les events de fin technique ne sont pas rejoués comme des commandes Sighty lors
d'un seek ; ils sont dérivés de l'état reconstruit ou réémis sur le canal
d'observation prévu.

## 10. Invariants

- Le parent layout ignore la structure du contenu foreign.
- Sighty reste propriétaire des instances, du mount/unmount et du destroy.
- `replace-foreign` ne connaît que le slot, les roots de projection et la durée
  de la transition.
- Le wrapper et les clones de transition sont toujours temporaires et hors du
  registre de placement.
- Aucun node HTML runtime-only n'entre dans `SceneDoc`, `CompiledScene` ou un
  event sérialisé.
- Un remplacement ne crée jamais une seconde instance logique de la scène ; le
  clone est uniquement une représentation visuelle.
- Play, seek et replay convergent vers la même représentation au même temps.
- Le contenu d'une scène enfant n'est jamais inspecté par le layout ou
  `replace-foreign`.

## 11. Validation prévue

La tranche devra traverser le chemin réel :

1. un layout compilé expose un slot `content` ;
2. une scène enfant est montée par un event Sighty simulé via le bridge réel ;
3. une seconde scène est préparée et remplace la première avec `fade` ;
4. le wrapper et les clones sortants sont transitoires et absents des cibles de
   placement ;
5. une scène multi-racines conserve son ordre au montage et dans la transition ;
6. l'event de fin permet à Sighty de démonter l'ancienne scène ;
7. un update de la scène active ne rerend pas le layout ;
8. un seek avant, pendant et après la transition converge vers l'état attendu ;
9. une interruption nettoie sans détruire la mauvaise instance.

Les tests doivent utiliser le materializer HTML et le pipeline event réels. Une
fixture visuelle peut compléter les assertions, mais ne remplace pas la
validation des ownership, du journal, du seek et du lifecycle.

## 12. Hors périmètre de la première tranche

- split texte ou split cellules sur une scène foreign ;
- inspection ou animation des persos internes de la scène enfant ;
- racines réparties entre plusieurs slots ou plusieurs hôtes ;
- transport distant de nodes HTML ;
- destruction automatique d'une instance Sighty par CodPlay ;
- materializers non HTML et transition spécifique à Three.js, Rive ou Canvas.

Ces extensions devront fournir leur propre adapter de projection et ne devront
pas modifier la sémantique de `replace-foreign` HTML.
