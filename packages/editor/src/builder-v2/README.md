# Builder ed2 natif CodPlay V2

> Statut : En cours
> CodPlay cible : V2 foundation

Cette verticale traduit `EditorScene` vers le `SceneDoc` natif de CodPlay V2. Elle ne dépend pas
du builder V1 et ne fournit aucune compatibilité avec ses types ou son player.

Le premier incrément accepté couvre une scène ed2 à une story (`story-main`), une capsule racine
implicite et un item texte portant deux keyframes. La résolution de décor est pure et locale à
cette verticale ; `Decor.style` et `Decor.custom` deviennent le style V2, tandis que les offsets
structurés sont refusés tant que la capacité `cqw` V2 n'est pas disponible. Les zones sont signalées
comme différées : leur matérialisation CSS relève de `capsule-automation` et de la tranche zones
postérieure à l'intégration V2.

La sortie signale toujours les erreurs sous forme de diagnostics et ne retourne jamais de `SceneDoc`
partiel. Le manifeste de preload est vide dans ce premier incrément, car aucune feuille CSS de
capsule n'est encore produite ; il sera alimenté lorsque la résolution `capsule-automation` sera
portée nativement.
