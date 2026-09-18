# CodPlay V2 — relation immuable des composants projetés

## Statut

> Status: Fixe pour la déclaration et la résolution commune ; les conventions
> propres aux bibliothèques restent externes
> CodPlay version: V2 foundation
> Décision: 2026-09-18
> Plan: [`../plan/2026-09-18-third-party-render-target-codplay-plan.md`](../plan/2026-09-18-third-party-render-target-codplay-plan.md)

Cette spécification fixe la donnée de relation et son passage dans la scène
compilée. La résolution runtime commune est décrite dans la
[spécification du pont](./third-party-target-bridge-spec.md) ; les conventions
de matérialisation des bibliothèques tierces restent dans leurs packages.

## Déclaration auteur

`rel` est une propriété du profil initial d'un perso :

```ts
initial: {
  rel: {
    target: {
      scene: '#scene-id',
      perso: '#perso-id',
    },
  },
}
```

`target.scene` est obligatoire et identifie la scène. `target.perso` est
facultatif ; lorsqu'il est absent, la relation désigne la scène elle-même.
Les identifiants sont des chaînes non vides.

Une intégration peut ajouter des champs propres à sa bibliothèque au niveau de
`rel`. Le core ne les interprète pas. Le champ `target` conserve uniquement la
forme commune `scene` / `perso`.

## Immutabilité

`rel` est structurellement immuable pendant la lecture. Il est lu depuis
`initial`, puis séparé de l'initial du composant lors de la compilation. Une
action qui contient `rel` est ignorée et produit le warning auteur
`AUTHOR_REL_ACTION_IGNORED` ; elle ne bloque ni la construction ni la lecture.

Une relation initiale invalide produit le warning auteur `AUTHOR_REL_INVALID`.
La scène reste constructible et le perso est compilé sans relation. Ces
warnings sont émis dans le contexte auteur et restent silencieux en diffusion,
selon le contrat général des diagnostics non bloquants.

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

La tranche est couverte par :

- `tests/scene/validation/capability-validation.spec.ts` pour les warnings
  non bloquants et leurs chemins auteur ;
- `tests/scene/compiled/scene-builder.spec.ts` pour la séparation et
  l'immutabilité de la relation ;
- `tests/scene/compiled/scene-builder.spec.ts` pour les warnings non bloquants
  des identités scène/perso inconnues ;
- `tests/scene/compiled/codec.spec.ts` pour la sérialisation et le rejet d'une
  identité compilée invalide.
