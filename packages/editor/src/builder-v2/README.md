# Builder ed2 natif CodPlay V2

> Statut : En cours
> CodPlay cible : V2 foundation

Cette verticale traduit `EditorScene` vers le `SceneDoc` natif de CodPlay V2. Elle utilise uniquement
le transport V2 de l'éditeur vers CodPlay.

L'incrément en cours couvre une scène ed2 à une story (`story-main`), sa capsule racine implicite,
une arborescence de capsules imbriquées et les feuilles (`bloc`, `text`, `image`, `video` et
`media`), avec zéro, une ou plusieurs keyframes. Les persos sont natifs V2 et leurs relations sont
portées par `move.target` ; aucun parentage n'est relu dans le DOM.

La résolution de décor est pure et locale à cette verticale. `Decor.style` et `Decor.custom` sont
projetés vers le style V2, les couleurs autonomes des propriétés nommées couleur sont normalisées
en `ColorValue`, les différences entre keyframes deviennent des actions V2 et les classes restent
discrètes. Les longueurs structurées de `Decor.offset` sont émises comme nombres `unitless` du
contrat éditeur-player, sans conversion en chaîne CSS ni objet de compilation. CodPlay qualifie
ensuite `x`, `y`, `width` et `height` en longueur logique selon sa configuration. Les autres chaînes
CSS restent opaques. Les zones sont signalées comme différées : leur preview reste une responsabilité de l'éditeur et leur
matérialisation par `capsule-automation` fera l'objet de la tranche zones.

Chaque niveau de capsule est résolu par `capsule-automation`, qui reste l'unique producteur des
classes de placement et de la feuille CSS scoped. Le builder concatène cette feuille dans
`styleSheet` et expose la grille racine dans `rootGrid`; il n'invente ni règle ni URL.

La sortie signale toujours les erreurs sous forme de diagnostics et ne retourne jamais de `SceneDoc`
partiel. `preloadManifest` reste vide à cette frontière pure : le bridge navigateur transmettra plus tard
`styleSheet` à `codplay.preload.css.set()`, tandis que les URLs de contenu sont dérivées par
`CodPlay.build()`. Cette verticale ne dépend d'aucun builder parallèle ni d'un player détenu par
l'éditeur.
