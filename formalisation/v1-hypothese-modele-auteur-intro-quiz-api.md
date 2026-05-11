# V1 - hypothese modele auteur - intro quiz via API CodPlay

## Statut

Document d'hypothese pour decrire un modele auteur utilisable avec les APIs V1.

## Objectif

Montrer comment un auteur peut construire la sequence "intro -> quiz -> bravo|dommage" en utilisant:

- `AuthoringApi`
- `BuilderApi`
- `PlayerApi`

## Hypothese de structure narrative

Stories:

- `story-intro`: animation d'introduction
- `story-quiz`: question + formulaire `<form />`
- `story-bravo`: sequence animee + voix succes
- `story-dommage`: sequence animee + voix echec

Routage:

- `intro:done` active le quiz
- `quiz:result:correct` route vers `story-bravo`
- `quiz:result:wrong` route vers `story-dommage`

## Composants utilises (hypothese)

- `text`, `img`, `list` pour l'intro et le decor
- `form` pour le quiz (post-V1 prioritaire)
- `media` pour les voix `bravo` et `dommage`
- optionnel: `rich-text` pour le prompt de quiz

## Straps utilises

- `quiz-choice-visuals`: transforme `quiz:choice:changed` en events visuels
- `quiz-evaluate`: transforme `quiz:submit` en `quiz:result:correct|wrong`
- `route-result`: route selon le resultat

## Modele auteur propose

## 0) Origine de `studio`

`studio` est l'instance principale orientee auteur, creee cote outil (editeur, script, back-office), avant toute definition de scene.

Exemple:

```ts
const studio = new Codplay()

const builder = studio.builder
const player = studio.player
```

Convention d'ecriture retenue dans ce document:

- `studio.story.upsert(...)` pour declarer/mettre a jour une story de facon idempotente
- `studio.story.create(...)` resterait possible si on force "creation only"
- ici, `upsert` est prefere pour simplifier les iterations auteur

Note de compatibilite:

- si une implementation expose `authoring.upsertStory(...)`, elle peut fournir un alias vers `studio.story.upsert(...)`

## 1) Creation scene

```ts
studio.create({ id: "scene-intro-quiz" })

studio.scene.initial.set({
  value: {
    title: "Intro Quiz",
    locale: "fr"
  }
})

studio.scene.straps.set({ value: ["route-result"] })
studio.scene.listen.set({
  value: [
    { on: "quiz:result:correct", emit: [{ name: "scene:route:bravo" }] },
    { on: "quiz:result:wrong", emit: [{ name: "scene:route:dommage" }] }
  ]
})
```

## 2) Story intro

```ts
studio.story.upsert({
  story: {
    id: "story-intro",
    children: [],
    initial: { mode: "intro" },
    straps: undefined,
    listen: [
      { on: "scene:start", emit: [{ name: "intro:play" }] },
      { on: "intro:finished", emit: [{ name: "intro:done", cascade: true }] }
    ],
    persos: [
      {
        id: "intro-title",
        type: "text",
        initial: { content: "Bienvenue" },
        actions: {
          "intro-title": null,
          "intro:play": { style: { opacity: { from: 0, to: 1, duration: 600 } } }
        }
      }
    ],
    init: () => undefined
  }
})
```

## 3) Story quiz

```ts
studio.story.upsert({
  story: {
    id: "story-quiz",
    children: [],
    initial: {
      questionId: "q1",
      correctChoiceId: "c2"
    },
    straps: ["quiz-choice-visuals", "quiz-evaluate"],
    listen: [
      { on: "intro:done", emit: [{ name: "quiz:show" }] },
      { on: "quiz:choice:changed", straps: ["quiz-choice-visuals"] },
      { on: "quiz:submit", straps: ["quiz-evaluate"] }
    ],
    persos: [
      {
        id: "quiz-form",
        type: "form",
        initial: {
          questionId: "q1",
          choices: [
            { id: "c1", label: "Reponse A" },
            { id: "c2", label: "Reponse B" },
            { id: "c3", label: "Reponse C" }
          ]
        },
        actions: {
          "quiz-form": null,
          "quiz:show": { style: { opacity: { from: 0, to: 1, duration: 250 } } },
          "quiz:choice:visual:selected": { className: { add: "is-selected" } },
          "quiz:choice:visual:unselected": { className: { remove: "is-selected" } }
        },
        emit: {
          change: { event: { name: "quiz:choice:changed" } },
          submit: { event: { name: "quiz:submit" } }
        }
      }
    ],
    init: () => ({
      currentSelectedChoiceId: undefined,
      isAnswered: false
    })
  }
})
```

## 4) Stories resultat

```ts
studio.story.upsert({
  story: {
    id: "story-bravo",
    children: [],
    initial: { mode: "bravo" },
    straps: undefined,
    listen: [{ on: "scene:route:bravo", emit: [{ name: "bravo:play" }] }],
    persos: [
      {
        id: "bravo-voice",
        type: "video",
        initial: { src: "/audio/bravo.mp3", master: true },
        actions: {
          "bravo-voice": null,
          "bravo:play": { broadcast: { type: "START" } }
        }
      }
    ],
    init: () => undefined
  }
})

studio.story.upsert({
  story: {
    id: "story-dommage",
    children: [],
    initial: { mode: "dommage" },
    straps: undefined,
    listen: [{ on: "scene:route:dommage", emit: [{ name: "dommage:play" }] }],
    persos: [
      {
        id: "dommage-voice",
        type: "video",
        initial: { src: "/audio/dommage.mp3", master: true },
        actions: {
          "dommage-voice": null,
          "dommage:play": { broadcast: { type: "START" } }
        }
      }
    ],
    init: () => undefined
  }
})
```

## 5) Root stories

```ts
studio.scene.rootStories.set({
  value: ["story-intro", "story-quiz", "story-bravo", "story-dommage"]
})
```

## 6) Export auteur -> compile -> run

```ts
const sceneDocResult = studio.exportSceneDoc()
if (!sceneDocResult.ok) throw new Error(sceneDocResult.error.code)

const compileResult = builder.compile({ scene: sceneDocResult.data })
if (!compileResult.ok) throw new Error(compileResult.error.code)

await player.init({
  mountTarget,
  compiledScene: compileResult.data.compiledScene,
  resourceManifest: compileResult.data.resourceManifest,
  runtimePolicy: {
    masterClock: {
      unique: true,
      previousMasterAction: "pause",
      fallbackToTicker: true
    }
  }
})

await player.play()
```

## Remarques auteur importantes

- le `<form />` est porte par le composant `form`, pas par un strap
- les effets visuels coche/decoche sont story-level via events et actions
- la logique de correction est dans `quiz-evaluate`
- les sequences `bravo`/`dommage` peuvent etre animees avec eventimes story-level
- les voix peuvent activer `master: true` sur le perso media

## Limites connues de l'hypothese

- `form`, `input`, `media` enrichi, `rich-text`, `rich-media` sont cibles post-V1 dans l'implementation
- le modele ci-dessus est d'abord un contrat auteur/API de reference

## Conclusion

Le modele auteur recommande se base sur une separation nette:

- composant = capture UI + rendu
- strap = decision metier
- story/scene = orchestration narrative

Cette separation permet a un auteur de construire un quiz reusable via APIs CodPlay, sans hack `seek` et sans melange DOM/metier.
