# Quiz Question Spec V1 - exemple controle par story et straps

## Statut

Spec de reference pour la progression du present exemple de quiz.

Important:

- ici, `V1` designe la progression de cet exemple de quiz
- `V1` ne designe pas la V1 globale de Codplay dans son ensemble

## Objectif

Definir une implementation de quiz unitaire dans Codplay avec les proprietes suivantes:

- environnement controle par story et straps
- pas de `form` dans la scene du quiz
- projection deterministic des composants a partir d'evenements trackes
- `seek` fiable sur l'etat post-validation
- separation claire entre logique de selection, validation, correction et aggregation scene-level

## Decision structurante

Pour cet exemple, la scene n'utilise plus le composant `form`.

Le composant `form` reste disponible dans le projet pour d'autres scenes ou evolutions futures.

Le quiz s'appuie sur:

- un panneau story-owned comme enveloppe de structure
- des `input`
- des boutons explicites
- un `story.state`
- des straps de story pour la logique locale
- un strap de scene pour l'aggregation

Consequences:

- la logique metier n'est pas gouvernee par un `form`
- la scene reste structuree par un panneau story-owned
- la selection est geree par `story.state`
- la validation est geree par strap
- la correction visuelle des reponses est geree par les `input` cibles
- le resultat texte et le bouton `Suivant` restent story-owned

## Principes retenus

1. Codplay est ici un environnement controle, pas un moteur de formulaire natif.
2. Le `seek` doit rejouer l'etat valide, pas reconstruire une interaction DOM native.
3. Les changements d'etat utiles au `seek` doivent etre portes par des evenements trackes.
4. Les changements de saisie intermediaires ne font pas partie du contrat de rejeu de cette V1.
5. Le composant `input` reste generique.
6. Le bouton `Valider`, le resultat `Correct/Incorrect` et le bouton `Suivant` appartiennent a la story.
7. Les straps portent la logique metier du quiz.
8. L'aggregation des reponses appartient a la scene.

## Perimetre de cette V1

Cette V1 couvre:

- une question affichee seule
- types `boolean`, `single`, `multiple`
- un panneau story-owned comme conteneur de la question
- selection locale des reponses
- validation explicite via bouton `Valider`
- emission d'un evenement canonique de resolution
- affichage optionnel du resultat
- affichage optionnel du bouton `Suivant`
- correction visuelle optionnelle sur les `input`
- verrouillage des reponses apres validation irreversible
- aggregation scene-level des resultats
- `console.log` en simulation de livraison externe
- `seek` fiable sur l'etat post-validation

Cette V1 ne couvre pas encore:

- scene finale de score
- affichage de progression dans l'UI
- gestion de delai de reponse
- gestion complete de `retry`
- persistence reelle vers une base de donnees

## Contrats de donnees

### Question resolue

```ts
type QuizQuestionType = 'boolean' | 'single' | 'multiple'

type QuizAnswer = {
  id: string
  label: string
  isCorrect: boolean
}

type QuizQuestionLabels = {
  validate: string
  next: string
  correct: string
  incorrect: string
  multipleHint: string
}

type ResolvedQuizQuestion = {
  index: number
  type: QuizQuestionType
  prompt: string
  answers: QuizAnswer[]
  labels: QuizQuestionLabels
}
```

Contraintes:

- `index` est l'identifiant fonctionnel de la question dans l'exemple
- `answers` contient au moins deux reponses
- `single` contient exactement une reponse correcte
- `boolean` contient exactement deux reponses
- `multiple` contient une ou plusieurs reponses correctes

### Configuration durable de story

Cette configuration est stable pendant toute la vie de la story.

```ts
type QuizQuestionStoryConfig = {
  showCorrection: boolean
  showResult: boolean
  maxRetries: number
  disableValidateAfterSubmit: boolean
}
```

Semantique:

- `showCorrection`: active ou non la correction visuelle des reponses apres validation
- `showResult`: active ou non le message story-owned `Correct/Incorrect`
- `maxRetries`: nombre maximum d'essais autorises dans une evolution future
- `disableValidateAfterSubmit`: rend `Valider` irreversiblement consomme dans cette V1

### Etat de story

```ts
type QuizQuestionResolvedPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}

type QuizQuestionStoryState = {
  question: ResolvedQuizQuestion
  config: QuizQuestionStoryConfig
  selectedAnswerIds: string[]
  resolved?: QuizQuestionResolvedPayload
  retryCount: number
}
```

Regles:

- `selectedAnswerIds` porte la selection courante en live
- `resolved` est l'unique verite rejouable de l'etat post-validation
- si `resolved` est absent, la question n'est pas encore validee
- si `resolved` est present, la question est consideree comme resolue pour cette V1

### Etat de scene

```ts
type QuizQuestionAnsweredPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}

type QuizSceneState = {
  answers: QuizQuestionAnsweredPayload[]
  answeredCount: number
  correctCount: number
  lastQuestionIndex?: number
  lastResult?: boolean
}
```

## Evenements

### Evenements locaux de story

```ts
type QuizQuestionAnswerSelectPayload = {
  answerId: string
}
```

Evenements retenus:

- `quiz:question:answer:select`
- `quiz:question:validate`
- `quiz:question:retry`
- `quiz:question:next`

Regles:

- `quiz:question:answer:select` met a jour la selection courante dans `story.state`
- `quiz:question:validate` demande une evaluation immediate de la selection courante
- `quiz:question:retry` est reserve a une evolution future
- `quiz:question:next` est emis uniquement au clic sur le bouton story-owned `Suivant`

### Evenement canonique de resolution

Evenement retenu:

- `quiz:question:resolved`

Payload:

```ts
type QuizQuestionResolvedPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}
```

Regles:

- `quiz:question:resolved` est l'evenement canonique tracke pour l'etat post-validation
- en V1, seul cet etat post-validation doit etre rejouable au `seek`
- la selection intermediaire avant validation n'est pas couverte par le contrat de rejeu

### Evenement metier public

Evenement retenu:

- `quiz:question:answered`

Payload:

```ts
type QuizQuestionAnsweredPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}
```

Regles:

- `quiz:question:answered` est emis une fois la validation devenue irreversible
- cet event est celui ecoute par l'agregateur scene-level

## Composants et props autorisees

### `input`

Le composant `input` reste generique.

Il porte:

- le rendu d'une reponse
- son etat `checked`
- son etat `disabled`
- son `visualState`

Etat visuel autorise:

```ts
type InputVisualState =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'
```

Props d'action autorisees pour `input`:

```ts
type InputActionDoc = {
  checked?: boolean
  disabled?: boolean
  visualState?: InputVisualState
}
```

Notes:

- `input` ne calcule jamais la verite metier
- `input` ne sait pas decider seul s'il est correct ou incorrect
- `input` ne sait que projeter l'etat que la story lui donne

### `button` Valider

Le bouton `Valider` peut etre un composant story-owned explicite ou une structure equivalente.

Il porte:

- l'emission de `quiz:question:validate`
- l'etat `disabled`

### `result`

Le message `Correct/Incorrect` est story-owned.

Il ne fait pas partie du contrat du composant `form`.

### `next`

Le bouton `Suivant` est story-owned.

Il ne fait pas partie du contrat du composant `form`.

## Structure runtime recommandee

Structure recommandee pour une question:

- un panneau story-owned pour cadrer visuellement la zone quiz
- un enonce story-owned
- un hint eventuel story-owned
- un `input` par reponse
- un bouton `Valider` sous les reponses
- un cartouche resultat story-owned sous `Valider`
- un bouton `Suivant` story-owned sous le resultat

Ordre visuel attendu:

1. enonce
2. reponses
3. bouton `Valider`
4. resultat
5. bouton `Suivant`

## Repartition des responsabilites

### Story

La story porte:

- la selection courante `selectedAnswerIds`
- la configuration durable `config`
- l'etat `resolved`
- la projection du resultat
- la projection du bouton `Suivant`
- la projection de l'etat final des `input`

### Strap de story

Le strap de story porte:

- la mise a jour de `selectedAnswerIds` au `select`
- la validation exacte au `validate`
- l'emission de `quiz:question:resolved`
- l'emission de `quiz:question:answered`

### Strap de scene

Le strap de scene porte:

- l'aggregation des `quiz:question:answered`
- la mise a jour de `scene.state`
- la simulation de livraison externe par `console.log`

## Flux nominal

1. la scene initialise la story avec sa question et sa configuration durable
2. l'utilisateur selectionne une reponse
3. la story met a jour `selectedAnswerIds`
4. le bouton `Valider` devient actif si la selection est non vide
5. l'utilisateur clique `Valider`
6. le strap compare `selectedAnswerIds` a `correctAnswerIds`
7. le strap emet `quiz:question:resolved`
8. le strap emet `quiz:question:answered`
9. la story projette:
   - le resultat si `config.showResult`
   - le bouton `Suivant`
   - les `InputActionDoc` de correction si `config.showCorrection`
   - `Valider` desactive si `config.disableValidateAfterSubmit`
10. le strap de scene agrege et trace le resultat par `console.log`

## Contrat de seek

Le `seek` doit garantir les proprietes suivantes:

- avant validation, la selection courante n'est pas contractuellement rejouee en V1
- apres validation, la story retrouve exactement son `resolved`
- apres validation, les `input` retrouvent leur `checked`, `disabled` et `visualState`
- apres validation, le resultat story-owned retrouve son affichage
- apres validation, `Suivant` retrouve son affichage
- apres validation, `Valider` reste consomme si `config.disableValidateAfterSubmit = true`

## Aggregation scene-level

Quand la validation est irreversible:

- le resultat est transmis a un strap de scene
- ce strap accumule les reponses dans `scene.state`
- il peut produire un `console.log` a chaque resultat
- il peut plus tard produire un `console.log` final de lot

Pour cette V1:

- la simulation d'envoi externe se fait par `console.log`
- aucun `fetch` reel n'est requis

## Contraintes pour les evolutions suivantes

Ces points sont hors perimetre de la V1 presente, mais doivent rester compatibles avec le contrat choisi.

### `retry`

La version suivante devra pouvoir:

- reouvrir une question apres echec si la configuration l'autorise
- incrementer `retryCount`
- verifier `retryCount < config.maxRetries`
- remettre `resolved` a `undefined` avant un nouvel essai

### `delay`

La version suivante devra pouvoir:

- limiter dans le temps la possibilite de repondre
- s'appuyer sur un strap externe de timing
- produire une resolution automatique si necessaire

Le timing ne doit pas etre gere par les composants de quiz eux-memes.

### Serie de questions

La version suivante devra ajouter:

- une serie de questions enchainees
- un indicateur de progression
- un bilan final
- une politique d'envoi externe:
  - soit au fil de l'eau
  - soit a la fin de la serie

## Validation de cette spec

Cette spec sera consideree correcte si l'implementation permet:

- une question unitaire `single`, `multiple` ou `boolean`
- une selection locale avant validation
- une validation explicite par bouton
- une emission unique de `quiz:question:resolved`
- une emission de `quiz:question:answered`
- un resultat story-owned optionnel
- un bouton `Suivant` story-owned optionnel
- une correction visuelle optionnelle des `input`
- un etat post-validation rejouable au `seek`
- une aggregation scene-level par `console.log`
