# CodPlay V2 - valeurs couleur

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before color defaults

La normalisation pure des noms CSS, formes hexadecimales et `rgb/rgba` vers
`ColorValue` sRGB est en place. Le branchement aux proprietes declarees et les
defaults de couleur restent hors de cette tranche.

Les couleurs sont traitees comme des valeurs intermediaires, distinctes des
chaines CSS et distinctes des proprietes de transformation. Leur preparation doit
etre faite avant l'interpolation ACE.

## Contrat intermediaire existant

ACE porte deja la representation suivante :

```ts
type ColorValue = {
  kind: 'color'
  space: 'srgb' | 'oklch'
  coords: readonly number[]
  alpha: number
}
```

Les adapters normalisent les couleurs CSS avant la preparation d'un intervalle.
La preparation froide peut signaler une utilisation incorrecte d'une chaine brute;
le chemin chaud d'ACE interpole uniquement des `ColorValue` deja prepares et ne
revalide pas la syntaxe CSS.

## Entrees a normaliser

La premiere tranche couvre les formes effectivement presentes dans les scenes et
les tests :

- couleurs nommees vers `srgb`;
- hexadecimales `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` vers `srgb`;
- `rgb()` et `rgba()` vers `srgb`;
- les variantes HSL, OKLCH et autres espaces restent des extensions explicites,
  pas des conversions silencieuses.

Une couleur auteur est donc transformee en `ColorValue` par l'adapter ACE avant la
preparation d'un intervalle. La sanitation de scene pourra consommer cette forme
avant de produire l'artefact lorsqu'un contrat de propriete couleur sera fixe. Sa
forme CSS originale n'est pas necessaire a ACE;
la projection pourra la reconstituer selon le contrat du service de rendu.

AnimeJS 4.5 reconnait directement les formes hex, RGB et HSL dans son test de
couleur, mais ne traite pas les noms CSS comme une couleur normalisee dans cette
etape. V2 doit donc depasser ce test lexical : une couleur nommee doit etre resolue
par sa table explicite avant d'entrer dans `ColorValue`, sans demander au navigateur
de calculer sa valeur.

## Decisions a tester

- Les couleurs nommees et les formes RGB ont `space: 'srgb'` par defaut.
- L'alpha est toujours explicite dans l'intermediaire, avec `1` si absent.
- Une interpolation entre deux espaces differents est refusee tant qu'une conversion
  explicite n'est pas demandee.
- Une valeur couleur inconnue ou mal formee produit un diagnostic; elle ne tombe pas
  dans une interpolation de chaine complexe.
- Aucun default de couleur universel n'est ajoute. `black`, `transparent` ou une
  autre valeur ne peuvent venir que du contrat de la propriete ou de la scene.

## Etapes

1. Ajouter un parseur pur et une table explicite des noms supportes.
2. Tester les formes RGB, hex, noms, alpha et erreurs.
3. Brancher la normalisation sur les proprietes declarees comme couleur, et non sur
   toutes les chaines du document.
4. Tester l'interpolation `ColorValue` deja fournie par ACE.
5. Declarer les defaults de couleur uniquement dans les services/composants qui en
   ont le besoin.
