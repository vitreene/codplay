# CodPlay V2 — source HTML de `Perso.emit` ordinaire

## Périmètre vérifié

Cette spécification couvre le sous-ensemble vérifié des événements DOM
déclarés par `Perso.emit` sans `capture`, lorsqu'ils sont raccordés à un
`HtmlPlayerRunner`. Les sorties et les entrées continues de capture relèvent de
la [spécification capture](./capture-v2-spec.md) et du
[plan S5](../plan/capture-s5-validation-plan.md).
Les comportements DOM non encore validés restent au
[plan `Perso.emit`](../plan/perso-emit-v2-portage-plan.md).

## Déclaration et compilation vérifiées

Une règle ordinaire peut porter un événement avec `name`, `data` et la portée
nommée `visibility`. La règle peut aussi porter les champs `ref`, `keyCode`,
`preventDefault` et `data` au niveau de l'action. Le compilateur préserve ces
champs ainsi que les données et la visibilité de l'événement. La preuve de
compilation exerce la portée `story` ; les autres portées et `mode` restent au
plan d'acceptation.

Le test de `SceneBuilder` couvre `ref`, `keyCode`, `preventDefault`, les données
de l'action et de l'événement, ainsi que `visibility: 'story'`. Cette forme
ordinaire est distincte de l'événement porté par une règle `capture` ; cette
spécification ne déplace ni ne définit le contrat de capture.

## Parcours HTML vérifié

À l'initialisation, `HtmlPlayerRunner` attache la source HTML ordinaire. Une
entrée DOM ne produit pas d'émission avant la lecture ou pendant une pause ;
après destruction du runner, le même événement ne produit plus d'émission.
Les tests runner vérifient ces frontières.

Le test runner vérifie aussi qu'une règle `click` ciblant une part matérialisée
atteint `RuntimePlayer.emit()`. L'événement journalisé conserve les données de
l'action et de l'événement, porte `visibility: 'story'` et ajoute le contexte
runtime `source: 'dom'`, `userEvent` et `persoId`. Le payload ne reçoit pas de
champ `self`.

Pour une règle clavier, `keyCode` est comparé à `KeyboardEvent.code` ;
`preventDefault()` n'est appelé que lorsque le code correspond. Un `ref`
inconnu publie le diagnostic `AUTHOR_COMPONENT_REF_UNKNOWN` avec l'identité du
perso. La valeur `value` d'un input est présente dans l'événement de sélection
testé par l'intégration `quiz-series`, avec `answerId` et le contexte DOM.

Le test d'intégration `quiz-series` valide également le parcours réel
`change → événement player → journal → listen/actions → materialisation` :
sélection, activation de Valider, validation et passage à la question suivante.

## Preuves

- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie la conservation des champs auteur ordinaires lors de la compilation.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  vérifie le clic sur une part, le cycle lecture/pause/destruction, le filtrage
  clavier, `preventDefault` et le diagnostic d'un `ref` inconnu.
- [`quiz-series-emit.spec.ts`](../tests/runtime/runner-html/quiz-series-emit.spec.ts)
  vérifie l'entrée `change`, le payload `answerId`/`value` et son effet sur la
  scène via le runner V2.
- Le relevé d'acceptation du portage consigne aussi un parcours manuel Safari,
  le 2026-08-29, sur `v2.html?demo=quiz-series` : sélection, validation et
  passage à la question suivante sans diagnostic applicatif.

Validation ciblée exécutée le 2026-09-26 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/scene/compiled/scene-builder.spec.ts \
  tests/runtime/runner-html/player-runner.spec.ts \
  tests/runtime/runner-html/quiz-series-emit.spec.ts
3 fichiers, 43 tests réussis
```

## Cas gardés au plan

La transmission de `visibility: 'scene'` et `'public'`, le mode d'insertion,
les règles multiples et leur ordre, le cycle Seek/reparent/reconstruction sans
écouteurs dupliqués, ainsi que l'intégration d'une scène mêlant des règles
ordinaires et de capture restent à valider. La vérification Safari historique
de `quiz-series` ne couvre pas ces gates supplémentaires.
