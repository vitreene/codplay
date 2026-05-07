# V1 - hypothese implementation - intro animee + quiz form

## Statut

Document d'hypotheses de conception base sur les specs V1.

## Convention temporaire (hypotheses)

- dans les exemples orientes API, l'instance principale est `studio` creee via `new Codplay()`
- cette convention est provisoire et sera re-evaluee post-V1

## Scenario cible

1. une scene demarre avec une introduction animee
2. ensuite un quiz apparait (1 question, 3 reponses, 1 correcte)
3. l'utilisateur valide via un vrai `<form />`
4. si reponse correcte: sequence `bravo`
5. sinon: sequence `dommage`

## Architecture proposee (grandes lignes)

- `Scene` orchestre le global (intro -> quiz -> resultat)
- `Story` porte la logique locale
- `Perso` porte le rendu UI
- `Straps` portent la logique metier de decision

## Decision principale

Creer un composant `form` (nouveau `Perso.type`) plutot que de mettre le formulaire dans un strap.

Raisons:

- un `<form />` est un composant DOM de rendu et d'interaction
- un strap doit rester une unite logique/runtime
- un composant `form` fournit les events d'interaction, puis la story pilote les effets visuels riches
- la logique de score reste testable dans un strap dedie

## Repartition des responsabilites

## Composant `form` (Perso)

Role:

- rendre un vrai tag `<form>`
- rendre les choix (radio)
- emettre les events de changement d'option (`change`)
- capter `submit`
- emettre un event runtime avec la reponse selectionnee

Exemple event emis:

```json
{
  "name": "quiz:submit",
  "data": {
    "questionId": "q1",
    "selectedChoiceId": "c2"
  },
  "context": {
    "source": "perso",
    "persoId": "quiz-form",
    "userEvent": "submit"
  }
}
```

Traitement coche/decoche:

- le composant `form` emet un event a chaque changement de choix
- la story `quiz` traite ces events pour declencher les effets visuels avances (highlight, transitions, feedback)
- les etats visuels coche/decoche riches sont portes par des actions de story, pas par l'UI systeme seule

Exemple event de changement:

```json
{
  "name": "quiz:choice:changed",
  "data": {
    "questionId": "q1",
    "selectedChoiceId": "c2"
  }
}
```

## Detail enchainement coche -> operations story

Cas de reference:

- etat initial: `c1` etait selectionnee
- utilisateur coche `c2`
- le navigateur decoche `c1` (radio group natif)

Sequence d'operations proposee:

1. le composant `form` capture `change` et emet `quiz:choice:changed` avec `selectedChoiceId="c2"` et `previousChoiceId="c1"`.
2. `story:quiz.listen` intercepte l'event (pipeline normal `listen -> straps -> emit -> persos`).
3. un strap de mapping UI (`quiz-choice-visuals`) prepare la liste des events visuels a declencher.
4. emission visuelle de de-selection pour l'ancienne option:
   - `quiz:choice:visual:unselected` cible `choice-c1`
   - actions possibles: retirer class active, opacite normale, reduction scale, arret glow
5. emission visuelle de selection pour la nouvelle option:
   - `quiz:choice:visual:selected` cible `choice-c2`
   - actions possibles: ajouter class active, accent couleur, scale-in, halo, micro-animation
6. emission optionnelle de feedback global question:
   - `quiz:question:selection-updated`
   - action possible: activer bouton submit si une option est selectionnee
7. mise a jour du state story:
   - `currentSelectedChoiceId = "c2"`
   - `isAnswered = true`
8. trace runtime:
   - journaliser `eventId`, `eventSeq`, `selectedChoiceId`, `previousChoiceId` pour debuggage/replay.

Exemple d'event complet recommande:

```json
{
  "name": "quiz:choice:changed",
  "data": {
    "questionId": "q1",
    "selectedChoiceId": "c2",
    "previousChoiceId": "c1"
  }
}
```

Notes d'implementation:

- la source de verite de la selection utilisateur reste le `<form>` natif.
- la story applique les enrichissements visuels (et non le navigateur seul).
- les effets visuels restent idempotents: re-jouer `selected` sur une option deja active ne doit pas casser l'etat.
- le submit lit soit `selectedChoiceId` du state story, soit la valeur du form (les deux doivent rester coherents).

## Actions UI du composant `form`

Actions utiles recommandees:

- `quiz:show`
- `quiz:disable`
- `quiz:enable`
- `quiz:reset`
- `quiz:error-no-choice`
- `quiz:choice:visual:selected`
- `quiz:choice:visual:unselected`
- `quiz:choice:visual:hover`

Ces actions pilotent l'UI, pas la decision correcte/fausse.

## Strap metier `quiz-evaluate`

Ecoute:

- `listen.on = "quiz:submit"`

Comportement:

1. lit `selectedChoiceId`
2. compare avec `correctChoiceId` (config story/state story)
3. emet:
   - `quiz:result:correct` ou
   - `quiz:result:wrong`

Option UX:

- emettre un event intermediaire `quiz:evaluating` si besoin

## Orchestration stories

Proposition simple:

- `story:intro`
  - joue l'introduction
  - emet `intro:done`
- `story:quiz`
  - sur `intro:done` -> `quiz:show`
  - sur `quiz:choice:changed` -> actions visuelles de selection/de-selection
  - sur `quiz:submit` -> strap `quiz-evaluate`
  - sur `quiz:result:correct` -> route `bravo`
  - sur `quiz:result:wrong` -> route `dommage`
- `story:bravo`
  - sequence animee de succes avec voix
- `story:dommage`
  - sequence animee d'echec avec voix

## Pourquoi pas "form dans strap"

Non recommande parce que:

- strap ne doit pas creer/manipuler la structure DOM du formulaire
- melange frontiere UI/metier
- baisse la portabilite et la testabilite

## Eventimes et temps dans ce cas

- ce scenario quiz simple ne requiert pas d'eventimes complexes
- l'intro animee peut etre drivee par tracks/eventimes
- le quiz et la transition vers resultat sont event-driven (interaction utilisateur)
- `story:bravo` et `story:dommage` peuvent utiliser des eventimes de story pour synchroniser animation + voix
- si la voix est marquee `master: true` sur le perso audio/video, la synchro temporelle suit ce master
- aucun besoin de `seek` systeme pour ce flow

## Flux runtime resume

1. `scene:start` -> intro
2. `intro:done` -> affichage form
3. `change` utilisateur -> `quiz:choice:changed` -> effets visuels story
4. `submit` utilisateur -> `quiz:submit`
5. strap `quiz-evaluate` -> `quiz:result:correct|wrong`
6. routage vers `story:bravo` ou `story:dommage` (anime + voix)

## Mini modele de donnees quiz (hypothese)

```ts
type QuizQuestion = {
  id: string
  prompt: string
  choices: Array<{ id: string; label: string }>
  correctChoiceId: string
}

type QuizState = {
  currentQuestionId: string
  lastSubmittedChoiceId?: string
  lastResult?: "correct" | "wrong"
}
```

## Criteres de validation

- le formulaire est un vrai `<form />`
- les events `quiz:choice:changed` pilotent des effets visuels story-level
- soumission transporte la reponse selectionnee
- routage correct vers `bravo`/`dommage`
- logique de score dans strap, pas dans composant UI
- pipeline respecte `listen -> straps -> emit -> persos`

## Conclusion

Hypothese retenue:

- composant `form` pour le rendu et la capture utilisateur
- changements de selection exposes en events pour pilotage visuel par story
- strap `quiz-evaluate` pour la logique metier
- stories dediees pour intro/quiz/bravo/dommage
- sequences `bravo`/`dommage` animees avec voix synchronisee
- separation claire UI vs logique

## Suite post-V1 - composants a prevoir

Composants identifies comme necessaires juste apres V1:

- `form` (prioritaire): rendu `<form>`, capture `change/submit`, emission events UI vers story
- `input` (prioritaire): gestion fine d'un element de formulaire (checked, unchecked, focus, blur, error)
- `media` (prioritaire): lecture audio/video, support `broadcast` (`START/PAUSE/STOP`), integration `master: true`
- `rich-text` (prioritaire): composant texte evolue avec variantes de rendu et d'animation
- `rich-media` (prioritaire): composants d'animation/scene avances (`lottie`, `rive`, `threejs`)

Variantes cibles pour `rich-text`:

- texte enrichi limite aux tags texte (`span`, `strong`, etc.)
- html statique avec slots dynamiques injectes par data/runtime
- texte-bloc mono-ligne avec adaptation auto a la taille parent pour rester visible
- micro-animations texte preconstruites appelees par nom/expression
- un event unique peut declencher une suite d'animations internes au composant

Variantes cibles pour `rich-media`:

- `lottie`
- `rive`
- `threejs`

Note horloge runtime (important):

- comportement attendu egalement pour `media` non-master: suivi de l'horloge CodPlay (sans ticker interne propre)
- si `media.master=true`, le media peut devenir la reference temporelle active (selon policy master)
- pour `rich-media`, un ticker interne peut exister et se synchroniser a l'horloge CodPlay
- a l'initialisation, chaque composant `rich-media` doit declarer explicitement son mode de synchro a l'horloge generale
- cette declaration est obligatoire pour garantir une evolution deterministe du rendu pendant `play/pause/resume/stop`
- `master` peut etre applique en theorie aux composants `rich-media` (meme regles d'unicite/priorite/fallback)

Note specifique `threejs`:

- prevoir des variantes dediees de composant pour piloter finement des rendus cibles
- cas explicite prioritaire: animation de mascotte

Regles de frontiere recommandees:

- le composant lit le DOM et emet les events techniques
- la story garde la logique metier et les effets visuels enrichis
- les straps gardent la logique de decision et de routage
