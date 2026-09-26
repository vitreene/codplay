# CodPlay V2 — relation immuable des composants projetés

## Périmètre vérifié

Cette spécification fixe la forme auteur et compilée de `rel` ainsi que son
immutabilité. Ces comportements sont couverts par les tests de validation,
builder et codec. La résolution runtime relève de la
[spécification du pont](./third-party-target-bridge-spec.md) ; son acceptation
transverse est décrite dans le
[plan CodPlay](../plan/2026-09-18-third-party-render-target-codplay-plan.md).

## Déclaration auteur

`rel` est une propriété du profil initial d'un perso :

```ts
initial: {
  rel: {
    host: 'three-scene',
    target: 'avatar1',
  },
}
```

`host` est obligatoire et désigne le host qui possède le contexte de rendu.
`target` est facultatif : lorsqu'il est absent, le composant est simplement
attaché au host ; lorsqu'il est présent, il désigne une cible publiée par ce
host ou par un composant qui lui est attaché. Les deux identifiants sont des
chaînes non vides.

`host` ne désigne pas la scène logique CodPlay. `target` ne désigne pas un
nœud Three interne tel qu'un mesh, un os ou un morph target. Il désigne une
capacité publiée par l'intégration, par exemple un avatar identifié par
`avatar1`. Le mapping entre cette capacité et la structure réelle du modèle
reste externe à CodPlay.

Une intégration peut ajouter des champs propres à sa bibliothèque au niveau de
`rel`. Le core ne les interprète pas. Le champ `rel` conserve uniquement la
forme commune `host` / `target`. Les conventions de publication propres à une
bibliothèque restent dans son package.

## Immutabilité

`rel` est structurellement immuable pendant la lecture. Il est lu depuis
`initial`, puis séparé de l'initial du composant lors de la compilation. Une
action qui contient `rel` est ignorée et produit le warning auteur
`AUTHOR_REL_ACTION_IGNORED` ; elle ne bloque ni la construction ni la lecture.

Une relation initiale invalide produit le warning auteur `AUTHOR_REL_INVALID`.
La scène reste constructible et le perso est compilé sans relation. Ces
warnings sont émis dans le contexte auteur selon le contrat des diagnostics
non bloquants.

## Représentation compilée

La scène compilée porte la relation à côté des données métier du perso :

```ts
type CompiledPerso = {
  initial: CompiledRecord
  rel?: CompiledRel
  actions: Readonly<Record<string, CompiledValue>>
}
```

`CompiledRel` est sérialisable, immuable et ne contient aucun handle natif ni
type Three.js, Rive ou Lottie. Les fonctions éventuelles des extensions sont
traitées par la frontière d'extraction habituelle ; aucune bibliothèque tierce
n'est chargée par cette donnée.

La résolution de `rel` vers une cible runtime utilise l'identité compilée et le
registre player-local du pont. Cette spécification n'autorise pas une action à
modifier la relation et ne donne à l'auteur aucun accès au registre interne.

## Vérification

La forme `host`/`target` est implémentée. Les tests de relation couvrent
maintenant la séparation, la résolution directe et le codec :

- `tests/scene/validation/capability-validation.spec.ts` pour les warnings
  non bloquants et leurs chemins auteur ;
- `tests/scene/compiled/scene-builder.spec.ts` pour la séparation et
  l'immutabilité de la relation ;
- `tests/scene/compiled/scene-builder.spec.ts` pour le warning non bloquant
  d'une identité de host inconnue ;
- `tests/scene/compiled/codec.spec.ts` pour la sérialisation et le rejet d'une
  identité compilée invalide.
