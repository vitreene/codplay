# Composant input V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `input` fournit le contrôle de réponse utilisé par les interfaces
de quiz. Il construit un libellé, un contrôle natif, un indice et les éléments
visuels de sélection et de correction.

## Fonctionnement

Le profil `InputInitial` décrit les champs natifs, les réponses sélectionnées,
les états de correction et les styles des parties internes. La compilation
complète ce profil. Pendant la lecture, l'état visuel est calculé sans relire
le DOM, puis appliqué aux cinq parties du composant.

## Organisation interne

- `input-types.ts` décrit le profil du `perso`, les actions et les états ;
- `input-validation.ts` vérifie les champs et ajoute les valeurs par défaut ;
- `input-state.ts` dérive l'état natif et l'état visuel ;
- `input-visual-state.ts` regroupe les classes visuelles ;
- `input-component.ts` construit le template et applique l'état ;
- `index.ts` expose la surface publique.

La capacité `markup` ne publie que les deux icônes lorsque des éléments
extérieurs doivent les cibler.

## Contrat et limites

- le composant ne reconstruit pas son état à partir du DOM ;
- les actions standard de quiz restent des données de scène ;
- les valeurs communes de classe, style et attribut sont héritées de la base
  visuelle commune ;
- la validation des données auteur ne se fait pas dans la classe runtime.
