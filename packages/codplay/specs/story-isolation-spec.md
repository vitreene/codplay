# CodPlay V2 — isolation exclusive déclarative des stories

## Statut

> Status: En cours — contrat validé, implémentation intégrée; validation complète en cours
> CodPlay version: V2 foundation
> Décision: 2026-09-08
> Implémentation: intégrée partiellement; les gates de sortie restent ouverts
> Plan: [`../plan/story-isolation-plan.md`](../plan/story-isolation-plan.md)

## État de l'implémentation et validation (2026-09-08)

Le contrat est raccordé au chemin V2 de déclaration, compilation, journal,
dispatcher, materializer et runner. L'implémentation couvre notamment :

- la propriété auteur et compilée `active`, l'index exact de réveil par
  `(storyId, eventName)` et les diagnostics de cohérence associés ;
- les périodes d'activation, leur provenance, leur filtrage et la propagation
  aux occurrences différées et `repeat`, sans suppression des faits historiques ;
- la transition atomique `active: true` + `reset: true`, la fermeture
  idempotente et la réconciliation de la présentation ;
- le routage ciblé de la démo `position`, avec les règles déclaratives de ses
  stories et le retour vers une story déjà parcourue.

Une fuite de plans futurs a également été corrigée dans le chemin réel : une
sortie de strap explicitement ciblée vers une story ne peut plus hériter par
défaut d'une cascade scène vers toutes les stories. Cette provenance erronée
était la cause du plan ciblé obsolète qui provoquait un échec structurel lors
du Seek.

Validation effectuée :

- 7 fichiers de tests ciblés, 100 tests passés ;
- typecheck CodPlay V2 et typecheck de `@codplay/demos` V2 passés ;
- build de `@codplay/demos` passé ;
- sur la page Safari MCP existante de `5173`, cinq transitions clavier
  atteignent `06 / 06`, puis le parcours réel avec Seek ne produit plus
  l'erreur structurelle observée avant la correction ;
- le parcours Play instrumenté a enregistré 1 830 lectures
  `getBoundingClientRect` et 1 830 lectures de style calculé. Cette mesure est
  conservée comme point de contrôle, sans annoncer de pourcentage de baisse
  tant qu'une mesure de référence strictement comparable n'a pas été rejouée.

La suite CodPlay complète reste à traiter : 226 fichiers passent, 1 fichier
échoue, pour 1 713 tests passés et 1 test ignoré. L'échec est le test éditeur
existant `packages/editor/tests/scene-player-bridge-v2.spec.ts` (« keeps the
complete ghost chain ... »), qui attend `5000` et reçoit `undefined` ; il a
été reproduit avant cette tranche et n'est pas modifié opportunistement ici.
Les validations globales resize, persistence et lifecycle restent donc
ouvertes, et le statut de cette spécification demeure `En cours`.

## Objet

Une instance CodPlay peut jouer plusieurs stories successivement dans le même
journal et la même scène. L'isolation empêche les plans runtime futurs produits
par une story quittée de perturber la story suivante.

Une instance possède au plus une zone d'isolation active. Une activation ouvre
une nouvelle période de projection pour une story ; une désactivation clôt la
période courante. Les faits déjà inscrits dans le journal ne sont jamais
effacés.

Cette capacité n'est pas :

- `StoryDoc.disabled`, qui retire statiquement une story avant la compilation ;
- l'activation ou la désactivation d'une `RuntimeTrack` ;
- un changement de visibilité, un montage ou un démontage DOM ;
- un reset logique ;
- un manager de stories ou une API publique parallèle.

## Déclaration auteur

Une règle `listen` portée par une story accepte une propriété booléenne
`active` :

- `active: true` ouvre une nouvelle période d'isolation ;
- `active: false` clôt la période de la story adressée ;
- l'absence de `active` ne modifie pas l'isolation.

Le nom et les données de l'événement restent opaques. L'effet est porté par la
règle déclarative, pas par une propriété ajoutée à l'événement.

```ts
const POSITION_STORY_FIVE_ENTER = 'position:story-five:enter'
const POSITION_STORY_FIVE_LEAVE = 'position:story-five:leave'

const positionStoryFiveListen = [
  {
    on: POSITION_STORY_FIVE_ENTER,
    active: true,
    reset: true,
  },
  {
    on: POSITION_STORY_FIVE_LEAVE,
    active: false,
  },
]
```

L'activation et la désactivation sont uniquement des règles de `story.listen`.
Une règle `active` déclarée au niveau de la scène est invalide : une émission
de scène ne choisit pas implicitement la story qui doit être réveillée.

La cible reste séparée de l'événement :

```ts
instance.events.emit(
  { name: POSITION_STORY_FIVE_ENTER },
  { scope: 'story', storyId: 'position-story-five' },
)
```

## Index d'activation

La compilation construit, pour chaque story, un index exact
`eventName -> activation rule` à partir des règles dont `active === true`.
L'index est interne au `CompiledScene` et au runtime ; il n'est pas exposé à
l'auteur.

La lecture ne sonde donc pas `event.data`, ne devine pas la présence d'une
propriété et ne parcourt pas toutes les règles : pour une story inactive, le
dispatcher fait une recherche exacte dans cet index. Deux règles d'activation
pour le même événement et la même story constituent une déclaration ambiguë et
doivent produire un diagnostic de compilation.

## Routage d'une story inactive

Une story inactive n'est pas supprimée du journal et n'est pas désabonnée de
la scène. Le dispatcher applique la séquence suivante pour un événement qui
lui est adressé :

1. l'événement source est ajouté une seule fois au journal ;
2. l'index d'activation de la story est consulté ;
3. sans règle `active: true` correspondante, l'événement reste un fait de
   journal mais ne déclenche ni transform, ni strap, ni emit, ni reset pour
   cette story ;
4. avec une règle `active: true`, la nouvelle période est ouverte, puis la
   règle et les effets `listen` associés sont exécutés dans cette période.

`active: true` est donc une règle de réveil évaluée avant le filtre appliqué
aux stories inactives. Une story inactive peut toujours recevoir l'événement
qui la réactive.

Une règle `active: false` clôt la période si la story adressée en est la
propriétaire. Si elle ne l'est pas, l'opération est idempotente et ne touche
pas la période d'une autre story.

## Transition atomique et reset

`active: true` peut être combiné avec `reset: true` dans la même règle. Les deux
opérations appartiennent à la même frontière `(applyAtMs, eventSeq)` :

- l'ancienne période éventuelle est clôturée ;
- la nouvelle période reçoit une nouvelle identité interne ;
- le reset établit la frontière de projection de la story ;
- les effets de la règle sont évalués sans état intermédiaire observable.

Une nouvelle activation de la même story ferme donc son activation précédente
et ne réutilise jamais son identité.

Les autres mécanismes de `listen` restent dans le pipeline existant
`listen -> transform -> straps -> emit`. Les sorties produites par une règle
active héritent de l'identité d'activation résultante ; une sortie story-level
produite après une clôture ne peut pas être rattachée à l'ancienne période.

## Provenance des plans futurs

Chaque occurrence runtime produite par une story porte en interne l'identité de
la période qui l'a produite. Cela couvre les événements différés, les
occurrences `repeat`, les sorties de straps et leurs réinjections.

Une période est un intervalle ordonné par `(applyAtMs, eventSeq)`. Lorsqu'elle
est clôturée, une occurrence qui lui appartient reste dans le journal mais
n'est plus éligible à la projection après la frontière de clôture. Un Seek vers
un temps antérieur reconstruit la période historique correspondante et peut
donc relire les faits qui étaient alors valides.

Une sortie de portée `scene` ne reçoit pas implicitement cette identité et
reste indépendante de l'isolation. Une source externe qui doit être isolée
doit produire explicitement un événement ciblé story ; le nom de l'événement
ne suffit pas à lui attribuer une provenance.

## Invariants

- une instance n'a jamais deux périodes d'isolation ouvertes simultanément ;
- l'activation est locale à l'instance et à son journal ;
- les noms et données des événements ne sont pas préfixés ni modifiés ;
- aucune donnée n'est supprimée ou compactée lors d'une clôture ;
- une story inactive ne produit aucun effet `listen` sans règle de réveil ;
- `active: true` et `reset: true` forment une transition unique ;
- Play et Seek projettent les mêmes faits avec les mêmes frontières ;
- l'isolation ne remonte, ne démonte et ne recrée aucun nœud auteur ;
- l'isolation ne modifie ni l'horloge, ni `playing`/`paused`, ni l'état de scène
  ou de session ;
- `StoryDoc.disabled` et l'activation des tracks restent indépendants.

## Hors périmètre

- API publique `story.active()` ou gestionnaire de stories ;
- instanciation d'une scène supplémentaire ;
- activation implicite par un événement de scène non ciblé ;
- scheduler supplémentaire ;
- suppression, réécriture ou compaction du journal ;
- changement automatique de visibilité ou de montage DOM.

## Validation contractuelle

La tranche d'implémentation doit prouver :

- compilation de l'index d'activation et diagnostic des doublons ;
- réveil d'une story inactive par `active: true` ;
- ignorance des événements ordinaires par une story inactive, avec conservation
  du fait source dans le journal ;
- activation combinée à `reset: true` ;
- clôture idempotente par `active: false` ;
- fermeture implicite de l'ancienne story lors d'une nouvelle activation ;
- invalidation des `repeat` et événements différés de l'ancienne période ;
- conservation des sorties de scène non rattachées ;
- Seek avant, pendant et après une clôture puis une réactivation ;
- égalité de projection Play/Seek, sans remount ni second journal ;
- absence de confusion avec `StoryDoc.disabled` et les contrôles de tracks ;
- parcours réel de la démo position sur le dispatcher, le journal, le
  materializer et le runner.
