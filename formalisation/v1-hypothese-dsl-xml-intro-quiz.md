# V1 - hypothese DSL XML - intro quiz

## Statut

Document d'hypothese (non normatif) pour un DSL XML auteur.

## Convention temporaire (hypotheses)

- dans les exemples orientes API, l'instance principale est `studio` creee via `new Codplay()`
- cette convention est provisoire et sera re-evaluee post-V1

## Objectif

Imaginer un DSL XML capable de decrire la scene intro+quiz, avec:

- operations de boucle
- operations d'instanciation
- gestion des indeterminations (build-time ou runtime)

## Positionnement

- le XML est un format auteur
- un parseur DSL transforme XML -> `SceneDef` (modele CodPlay)
- puis `BuilderApi.compile(...)` produit `CompiledScene`

## Capacites DSL ciblees

## 1) Boucle

But: eviter la duplication d'elements repetitifs (ex: choix quiz).

Forme proposee:

```xml
<for each="quiz.choices" as="choice" index="i">
  ...
</for>
```

Semantique:

- evaluation au build
- expansion en noeuds concrets
- index stable pour determinisme

## 2) Instanciation

But: reutiliser des fragments/story templates.

Forme proposee:

```xml
<instantiate template="result-sequence" as="bravo" with="{ voice: '/audio/bravo.mp3' }" />
```

Semantique:

- copie structurelle du template
- injection des variables `with`
- generation d'identifiants derives (`as` prefix)

## 3) Indeterminations

But: declarer ce qui n'est pas resolu a l'ecriture auteur.

Forme proposee:

```xml
<unknown key="correctChoiceId" resolve="runtime" source="event:data.correctChoiceId" />
<unknown key="welcomeText" resolve="build" source="i18n.fr.intro.title" />
```

Semantique:

- `resolve="build"`: doit etre resolu avant compile finale
- `resolve="runtime"`: conserve un placeholder resolu par event/state runtime
- en absence de resolution valide: diagnostic builder

## Exemple XML complet (intro -> quiz -> bravo|dommage)

```xml
<codplay-scene id="scene-intro-quiz">
  <scene-initial>
    <var name="locale" value="fr" />
  </scene-initial>

  <scene-listen>
    <on event="quiz:result:correct">
      <emit name="scene:route:bravo" />
    </on>
    <on event="quiz:result:wrong">
      <emit name="scene:route:dommage" />
    </on>
  </scene-listen>

  <story id="story-intro">
    <listen>
      <on event="scene:start">
        <emit name="intro:play" />
      </on>
      <on event="intro:finished">
        <emit name="intro:done" cascade="true" />
      </on>
    </listen>
    <perso id="intro-title" type="text">
      <initial content="Bienvenue" />
      <action event="intro:play">
        <style opacity-from="0" opacity-to="1" duration="600" />
      </action>
    </perso>
  </story>

  <story id="story-quiz">
    <initial>
      <var name="questionId" value="q1" />
      <unknown key="correctChoiceId" resolve="runtime" source="quiz:config.correct" />
    </initial>

    <straps>
      <strap name="quiz-choice-visuals" />
      <strap name="quiz-evaluate" />
    </straps>

    <listen>
      <on event="intro:done">
        <emit name="quiz:show" />
      </on>
      <on event="quiz:choice:changed">
        <strap-ref name="quiz-choice-visuals" />
      </on>
      <on event="quiz:submit">
        <strap-ref name="quiz-evaluate" />
      </on>
    </listen>

    <perso id="quiz-form" type="form">
      <initial question-id="q1" />
      <emit on="change" event="quiz:choice:changed" />
      <emit on="submit" event="quiz:submit" />
    </perso>

    <for each="quiz.choices" as="choice" index="i">
      <perso id="choice-${choice.id}" type="text">
        <initial content="${choice.label}" />
        <action event="quiz:choice:visual:selected" target="choice-${choice.id}">
          <class add="is-selected" />
        </action>
        <action event="quiz:choice:visual:unselected" target="choice-${choice.id}">
          <class remove="is-selected" />
        </action>
      </perso>
    </for>
  </story>

  <template id="result-sequence">
    <story>
      <perso id="voice" type="video">
        <initial src="${voice}" master="true" />
        <action event="play">
          <broadcast type="START" />
        </action>
      </perso>
    </story>
  </template>

  <instantiate template="result-sequence" as="story-bravo" with="{ voice: '/audio/bravo.mp3' }" />
  <instantiate template="result-sequence" as="story-dommage" with="{ voice: '/audio/dommage.mp3' }" />

  <top-level initial-story-id="story-intro">
    <story-ref id="story-intro" />
    <story-ref id="story-quiz" />
    <story-ref id="story-bravo" />
    <story-ref id="story-dommage" />
  </top-level>
</codplay-scene>
```

## Regles de transformation XML -> SceneDef

1. parse XML en AST auteur
2. resoudre `for` (build)
3. resoudre `instantiate` (build)
4. resoudre `unknown resolve=build`
5. conserver placeholders `unknown resolve=runtime`
6. produire `SceneDef` compatible `AuthoringApi`/`BuilderApi`

## Gestion des indeterminations (proposition)

- `build`: echec bloquant si non resolu
- `runtime`: warning si non fourni lors de l'event d'ancrage/utilisation
- les valeurs runtime resolues doivent etre tracees pour observabilite

## Compatibilite pipeline CodPlay

- auteur: XML DSL
- conversion: `DSL -> SceneDef`
- compile: `builder.compile({ scene })`
- run: `player.init(...)`, `player.play()`

## Limites volontaires de l'hypothese

- syntaxe XML illustrative, non figee
- objectifs: clarifier les mecanismes (boucle, instance, indetermination), pas figer le parser

## Conclusion

Un DSL XML est compatible avec la scene intro+quiz si la conversion preserve:

- la separation composant/strap/orchestration
- le determinisme build
- la gestion explicite des inconnues runtime
