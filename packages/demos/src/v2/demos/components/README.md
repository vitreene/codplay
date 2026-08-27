# Démo des composants core V2

> Status: Fini — validation visuelle confirmée
> CodPlay version: V2 foundation

Cette démo fournit une seule `SceneDoc` au layout commun V2. Le titre
`basic components` est déclaré une seule fois dans le registre V2 ; le sélecteur
et l'en-tête le lisent au même endroit. Elle montre :

- `img`, avec une entrée en fondu et translation verticale ;
- `polygon`, avec un morph SVG temporel ;
- `input`, avec les cinq parts du composant et deux enfants montés dans les
  slots publics de la capacité `markup`/layout, puis une sélection et une
  correction pilotées par la timeline.

La télécommande V2 permet de comparer Play, Pause, Rewind et Seek. La démo
n'ajoute aucun circuit runtime parallèle et ne modifie pas le catalogue core :
elle étend seulement les parts publiques du layout hôte pour ses deux outlets.

`style.css` est chargé par le layout avec `codplay.preload.create()` avant la
création de l'instance. Le preload reçoit le conteneur de scène comme portée
CSS ; les styles de cette démo ne peuvent donc pas modifier la télécommande,
le journal ou l'en-tête communs.

## Vérification

Depuis la racine du dépôt :

```text
npm run demo:v2
```

Puis ouvrir `http://localhost:5173/?demo=components` pour sélectionner cette
présentation dans le registre V2.

Le build de la scène doit être accepté avant l'initialisation du runner. À
`800 ms`, le polygone commence son morph ; à `1700 ms`, la réponse Alpha est
sélectionnée ; à `2700 ms`, la correction est révélée. Un seek vers ces bornes
doit produire le même état que la lecture.
