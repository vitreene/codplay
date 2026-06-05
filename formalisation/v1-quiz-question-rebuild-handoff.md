# Quiz Question Rebuild Handoff

## But

Reconstruire la scene `quiz-question` et les adaptations runtime minimales necessaires, en repartant d'une base propre, sans reutiliser aveuglement les changements faits pendant la tentative precedente.

Ce document decrit:

- la cible fonctionnelle
- l'ordre de reconstruction recommande
- les composants a adapter
- les tests a ecrire / rerun
- les pieges qui ont casse le runtime global

## Cible fonctionnelle

La scene doit fournir:

- une question unitaire `boolean | single | multiple`
- un panel structurel en `layout`
- des reponses rendues via des `input`
- un bouton `Valider` story-owned
- un resultat `Correct/Incorrect` story-owned
- un bouton `Suivant` story-owned
- une correction visuelle apres validation seulement
- un `seek` fiable sur l'etat post-validation

## Regle principale

Ne pas reconstruire le quiz en partant d'un `form` runtime.

Le quiz doit etre pilote par:

- `story.state`
- des straps de story
- un strap scene-level d'aggregation
- des evenements trackes et rejouables

## Architecture cible

### 1. Scene

Fichier cible:

- `src/demos/scenes/quiz-question-scene.ts`

Types a definir:

- `QuizQuestionType`
- `QuizAnswer`
- `QuizQuestionLabels`
- `ResolvedQuizQuestion`
- `QuizQuestionStoryConfig`
- `QuizQuestionResolvedPayload`
- `QuizQuestionAnsweredPayload`
- `QuizQuestionStoryState`
- `QuizSceneState`

Etat de story minimal:

```ts
type QuizQuestionStoryState = {
  question: ResolvedQuizQuestion;
  config: QuizQuestionStoryConfig;
  selectedAnswerIds: string[];
  revealed?: QuizQuestionResolvedPayload;
  resolved?: QuizQuestionResolvedPayload;
  disabled: boolean;
  retryCount: number;
};
```

Etat de scene minimal:

```ts
type QuizSceneState = {
  answers: QuizQuestionAnsweredPayload[];
  answeredCount: number;
  correctCount: number;
  lastQuestionIndex?: number;
  lastResult?: boolean;
};
```

### 2. Structure du panel

Le panel doit etre un `layout`, pas un `list`.

Markup recommande:

```html
<fieldset class="quiz-question-fieldset">
  <legend data-part="quiz-question:title"></legend>
  <p data-part="quiz-question:hint"></p>
  <div data-part="quiz-question:answers"></div>
  <div data-part="quiz-question:controls"></div>
  <p data-part="quiz-question:result" aria-live="polite"></p>
  <div data-part="quiz-question:next"></div>
</fieldset>
```

Important:

- garder des enfants de type phrasing dans `legend` et `p`
- eviter `h2` dans `legend`
- le `fieldset` doit etre le root du `layout`

Persos story-owned a creer:

- `quiz-question-panel`
- `quiz-question-title`
- `quiz-question-hint`
- `quiz-question-validate`
- `quiz-question-result`
- `quiz-question-next`
- `quiz-question-${index}__answer-${answerId}` pour chaque reponse

### 3. Reponses

Chaque reponse doit etre un `input` monte dans `quiz-question:answers`.

Props initiales minimales:

```ts
{
  inputType: 'radio' | 'checkbox',
  name: `quiz-question-${question.index}-answer`,
  value: answer.id,
  label: answer.label,
  hint: '',
  checked: false,
  disabled: false,
  visualState: 'idle'
}
```

Emission utilisateur:

- `change -> quiz:question:answer:select`

Payload:

```ts
{
  answerId: string;
}
```

### 4. Validate / Result / Next

`quiz-question-validate`:

- tag `button`
- parent `quiz-question:controls`
- desactive par defaut
- `click -> quiz:question:validate`

Actions attendues:

- `quiz:question:selection:available` -> enable
- `quiz:question:selection:empty` -> disable
- `quiz:question:resolved` -> disable

`quiz-question-result`:

- tag `span`
- parent `quiz-question:result`
- hidden par defaut
- `quiz:question:resolved:correct` -> `Correct`
- `quiz:question:resolved:incorrect` -> `Incorrect`

`quiz-question-next`:

- tag `button`
- parent `quiz-question:next`
- hidden par defaut
- `click -> quiz:question:next`
- `quiz:question:resolved` -> hidden false

## Straps a reconstruire

### Story strap 1: selection

Nom recommande:

- `quiz-question-select`

Entree:

- `quiz:question:answer:select`

Responsabilites:

- mettre a jour `selectedAnswerIds`
- gerer toggle pour `multiple`
- remplacer la selection pour `single` / `boolean`
- emettre:
  - `quiz:question:selection:available` ou `quiz:question:selection:empty`
  - un event par reponse:
    - `quiz:question:answer:${id}:selected`
    - `quiz:question:answer:${id}:idle`

Retour attendu:

```ts
{
  update: {
    selectedAnswerIds,
    revealed,
    resolved,
    disabled,
    retryCount
  },
  events: [...]
}
```

### Story strap 2: submit

Nom recommande:

- `quiz-question-submit`

Entree:

- `quiz:question:validate`

Responsabilites:

- lire `selectedAnswerIds`
- calculer `correctAnswerIds`
- calculer `isCorrect`
- produire un `resolvedPayload`
- mettre `disabled: true`
- emettre:
  - `quiz:question:answered`
  - `quiz:question:resolved`
  - `quiz:question:resolved:correct` ou `quiz:question:resolved:incorrect`
  - les evenements answer-specific de revelation:
    - `revealed-correct`
    - `revealed-incorrect`
    - `revealed-missed-correct`
    - `locked`

Retour attendu:

```ts
{
  update: {
    selectedAnswerIds,
    revealed: resolvedPayload,
    resolved: resolvedPayload,
    disabled: true,
    retryCount
  },
  events: [...]
}
```

### Scene strap: aggregation

Nom recommande:

- `quiz-question-aggregate`

Entree:

- `quiz:question:answered`

Responsabilites:

- maintenir `answers`
- maintenir `answeredCount`
- maintenir `correctCount`
- maintenir `lastQuestionIndex`
- maintenir `lastResult`

Le `console.log('[quiz-question-aggregate]', ...)` peut rester seulement si la demo en depend explicitement.

## Adaptations runtime minimales

### Input component

Fichier cible:

- `src/runtime/components/input-component.ts`

Objectif:

- laisser `input` generique
- projeter l'etat quiz via les champs:
  - `selectedAnswerIds`
  - `correctAnswerIds`
  - `disableAnswers`
  - `showCorrection`
  - `visualState`

Comportements requis:

- si `showCorrection === false`, pas de correction visible
- si `showCorrection === true`, calculer le state visuel a partir de:
  - selected + correct -> `revealed-correct`
  - selected + incorrect -> `revealed-incorrect`
  - non selected + correct -> `revealed-missed-correct`
  - sinon `disabled` ou `idle`

### Outlets pour icones enfants

Si le quiz doit reconstruire les persos enfants `selectionIcon` / `correctionIcon`, alors `InputComponent` doit exposer:

- `getOutletsSnapshot()`

Outlets:

- `${perso.id}__selection-icon-slot`
- `${perso.id}__correction-icon-slot`

Important:

- si aucun enfant n'est monte, garder un fallback texte interne
- si des enfants existent dans le slot, ne pas ecraser leur contenu

## Tests a reconstruire

### Quiz runtime

Fichier cible:

- `tests/v1/quiz-question-runtime.spec.ts`

Cas minimaux:

1. Strap `select` -> la bonne selection est stockee
2. Strap `submit` -> le bon payload de resolution est emis
3. Rendu runtime initial:
   - panel layout
   - validate disabled
   - result hidden
   - next hidden
4. Rendu apres selection + validation:
   - classes input de correction
   - texte result
   - next visible
   - fieldset disabled
5. Seek apres validation:
   - etat rejoue identique
6. Boundary test `199 / 200 / 201ms`

### Input runtime

Fichier cible:

- `tests/v1/input-runtime.spec.ts`

Verifier:

- fallback icones sans enfants
- non ecrasement des icones si enfants montes
- transitions `idle -> selected -> revealed-*`

## Ordre de reconstruction

1. Repartir d'une base runtime verte:
   - `reference-scenes`
   - `horizon-diagnostics`
   - `track-runtime-controls`
   - `capture-session`
2. Refaire `quiz-question-scene.ts` sans icones enfants
3. Refaire `tests/v1/quiz-question-runtime.spec.ts`
4. Valider `seek` et `boundary 199/200/201`
5. Ajouter les outlets `input` + persos enfants d'icone
6. Ajouter `tests/v1/input-runtime.spec.ts`
7. Revalider tout le lot runtime + `npm run build`

## Commande de validation finale

```bash
npm test -- all -- tests/v1/horizon-diagnostics.spec.ts tests/v1/reference-scenes.spec.ts tests/v1/quiz-question-runtime.spec.ts tests/v1/track-runtime-controls.spec.ts tests/lot20/capture-session.spec.ts && npm run build
```

## Fichiers de reference utiles

- `formalisation/v1-quiz-question-spec.md`
- `src/demos/scenes/s4-quiz-reference-scene.ts`
- `src/runtime/components/input-component.ts`
- `src/runtime/components/runtime-component-orchestrator.ts`
- `tests/v1/reference-scenes.spec.ts`
- `tests/v1/horizon-diagnostics.spec.ts`
