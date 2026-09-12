# Sighty — façade scénario et runtime

## Statut

Première tranche : façade unique implémentée, stabilisation en cours.

## Point d'entrée public

`Sighty` est l'unique classe d'entrée de la librairie. Une instance regroupe
deux surfaces nommées :

- `scenario`, qui possède le fichier, le catalogue de scènes, les données et
  les requêtes d'authoring ;
- `runtime`, qui possède l'exécution CodPlay de ce scénario.

```ts
const sighty = new Sighty({
  scenario: { file, scenes, data },
  runtime: {
    root,
    instanceIds,
    layout: { sceneKey: 'layout', storyId: 'main' },
  },
})

const { scenario, runtime } = sighty
const layout = scenario.getScene('layout')
const diagnostics = scenario.validate()

await runtime.initialize()
await runtime.playAll()
runtime.detachSlot('main')
runtime.destroy()
```

Les options de runtime décrivent uniquement le raccordement à CodPlay : racine
de scène, identifiants d'occurrence, layout, preload et observations
facultatives. Elles ne décrivent ni contrôles, ni journal, ni présentation de
page.

## Surface `scenario`

`scenario` expose :

- `file`, `scenes` et `data` ;
- `sceneKeys`, `getScene(sceneKey)`, `getData(dataKey)`,
  `getView(sceneKey)` et `getSlotNames(sceneKey)` ;
- `validate()`, qui vérifie les références sans compiler ni jouer les scènes.

`getView(sceneKey)` recherche la vue dont la scène racine correspond à la clé
fournie. La première tranche suppose une vue racine par scène ; l'ordre du
tableau sérialisé `views` ne fait pas partie de l'API.

Cette surface ne crée ni DOM, ni player, ni montage.

## Surface `runtime`

`runtime` regroupe le cycle CodPlay générique : compilation, préchargement,
création des occurrences, montage des placements de la vue choisie, pilotage,
démontage et destruction.

Le runtime ne construit pas les composants de page et ne crée pas de circuit de
commande spécifique à une démonstration. Les pages conservent leurs contrôles,
leur journal, leur statut et le nettoyage de leur racine DOM.

La classe interne du runtime n'est pas exportée comme une seconde entrée. Elle
est créée par `Sighty` et accessible uniquement par `sighty.runtime`.

## Principes de structure

La séparation DRY/KISS/SRP est conservée derrière la façade unique :

- `sighty.ts` assemble les deux surfaces publiques ;
- `scenario.ts` porte l'implémentation des ressources et de la validation ;
- `runtime.ts` porte le cycle CodPlay commun ;
- `authoring-validation.ts` porte la validation du graphe auteur ;
- `types.ts` porte les contrats partagés ;
- `index.ts` n'expose que `Sighty` comme classe.

Les modules internes ne sont pas exposés comme sous-chemins du package : la
surface publique passe par `@codplay/sighty`.
