# Builder ed2 natif CodPlay V2

> Statut : En cours
> CodPlay cible : V2 foundation

Cette verticale traduit `EditorScene` vers le `SceneDoc` natif de CodPlay V2. Elle ne dépend pas
du builder V1 et ne fournit aucune compatibilité avec ses types ou son player.

L'incrément en cours couvre une scène ed2 à une story (`story-main`), sa capsule racine implicite,
une arborescence de capsules imbriquées et les feuilles (`bloc`, `text`, `image`, `video` et
`media`), avec zéro, une ou plusieurs keyframes. Les persos sont natifs V2 et leurs relations sont
portées par `move.target` ; aucun parentage n'est relu dans le DOM.

La résolution de décor est pure et locale à cette verticale. `Decor.style` et `Decor.custom` sont
projetés vers le style V2, les différences entre keyframes deviennent des actions V2 et les classes
restent discrètes. Les offsets structurés sont refusés tant que la capacité `cqw` V2 n'est pas
disponible. Les zones sont signalées comme différées : leur preview reste une responsabilité de
l'éditeur et leur matérialisation par `capsule-automation` fera l'objet de la tranche zones.

Chaque niveau de capsule est résolu par `capsule-automation`, qui reste l'unique producteur des
classes de placement et de la feuille CSS scoped. Le builder concatène cette feuille dans
`styleSheet` et expose la grille racine dans `rootGrid`; il n'invente ni règle ni URL.

La sortie signale toujours les erreurs sous forme de diagnostics et ne retourne jamais de `SceneDoc`
partiel. `preloadManifest` reste vide à cette frontière pure : le bridge navigateur créera plus tard
la ressource CSS à partir de `styleSheet`, tandis que les URLs de contenu sont dérivées par
`CodPlay.build()`. Cette verticale ne dépend pas du builder, du player ou des types V1.
