# CodPlay V2 - valeurs couleur

## Statut

> Status: Fini
> CodPlay version: V2 foundation
> Review: tranche sRGB/OKLCH validée le 2026-08-24; aucun default universel

La table de transcription des noms CSS vers les canaux RGB est isolee dans
`src/ace/adapters/named-colors.ts`. La normalisation pure des noms CSS, formes
hexadecimales, `rgb/rgba` et `oklch` vers `ColorValue` est en place. Le service `style` branche cette normalisation
sur ses proprietes couleur declarees avant l'extraction de `CompiledScene`.
Le player ne reparse donc pas les chaines CSS sur le chemin chaud.

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
- `oklch()` vers `oklch`, avec luminosite, chroma, teinte et alpha normalises;
- HSL et les autres espaces restent des extensions explicites, pas des
  conversions silencieuses.

Pour OKLCH, `L` est stocke dans `[0, 1]`, `C` est stocke dans l'echelle CSS
(`100% = 0.4`) et les angles `deg`, `grad`, `rad`, `turn` sont convertis en
degres canoniques dans `[0, 360)`. Les valeurs hors gamut ne sont pas converties
par ACE : l'espace OKLCH est conserve jusqu'au materializer.

Une couleur auteur est transformee en `ColorValue` par le sanitizer du service
`style`, qui delegue son parsing pur a l'adapter ACE, avant de produire
`CompiledScene`. Sa forme CSS originale n'est pas necessaire a ACE; la
materialisation la reconstitue selon le contrat du service de rendu.

AnimeJS reste une inspiration pour la preparation et la resolution d'intervalles,
mais la normalisation V2 est explicite et determinee avant l'execution. La
grammaire OKLCH suit [CSS Color 4](https://www.w3.org/TR/css-color-4/); les noms
CSS sont resolus par la table explicite sans demander au navigateur de calculer
leur valeur.

## Decisions a tester

- Les couleurs nommees et les formes RGB ont `space: 'srgb'` par defaut.
- `oklch()` conserve `space: 'oklch'`; aucune conversion implicite vers sRGB
  n'est faite.
- L'alpha est toujours explicite dans l'intermediaire, avec `1` si absent.
- Les valeurs HSL et les autres espaces ne sont pas acceptes par ce contrat.
- Une interpolation entre deux espaces differents est refusee tant qu'une conversion
  explicite n'est pas demandee.
- Une valeur couleur inconnue ou mal formee produit un diagnostic; elle ne tombe pas
  dans une interpolation de chaine complexe.
- Aucun default de couleur universel n'est ajoute. `black`, `transparent` ou une
  autre valeur ne peuvent venir que du contrat de la propriete ou de la scene.

## Etapes

1. Termine : ajouter un parseur pur, une table explicite des noms supportes et le
   parseur OKLCH.
2. Termine : tester les formes RGB, hex, noms, OKLCH, alpha et erreurs.
3. Termine : brancher la normalisation sur les proprietes declarees comme couleur,
   et non sur toutes les chaines du document.
4. Termine : tester l'interpolation `ColorValue` deja fournie par ACE.
5. Termine pour la fondation V2 : aucun default de couleur universel n'est
   declare; un default eventuel reste du ressort du contrat de sa propriete.
