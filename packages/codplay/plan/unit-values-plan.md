# CodPlay V2 - valeurs numeriques et unites CSS

## Statut

> Status: Fixe pour la conservation des unités
> CodPlay version: V2 foundation
> Review: tranche ACE/resolve/materializer HTML validée le 2026-08-20

## Frontiere

La compilation ne convertit pas une unité de rendu en une autre unité de rendu.
Elle conserve les unités explicites de l'auteur et transmet une forme préparée à
ACE. Pour le contrat éditeur V2, un nombre `unitless` de longueur structurée est
déjà une représentation logique définie : CodPlay lui attribue la longueur
`cq*` choisie par sa configuration (actuellement `cqw`). Cette qualification
sémantique n'est pas une conversion en `px` et ne s'applique pas aux chaînes CSS
ou aux valeurs CSS intrinsèquement `unitless`.

La conversion vers une unité de rendu appartient au materializer, car elle peut
dépendre du substrat, du viewport, du parent ou du contexte runtime de
materialization. Dans le cas `cqw` ed2, le player V2 fournit la largeur de la
racine de scène et le materializer réalise cette projection.

Le compile et le composant ne lisent donc ni le DOM, ni les styles calcules, ni les
dimensions du viewport pour transformer `cqw`, `%`, `px` ou une autre unite.

## Representation ACE

ACE separe deja la partie numerique et l'unite dans sa valeur decomposed :

```ts
type UnitValue = {
  number: number
  unit: string | null
}
```

La forme exacte reste a stabiliser dans le contrat public ACE, mais cette separation
est necessaire pour interdire une interpolation incoherente et conserver l'unite
choisie par l'auteur.

## Contrat ACE observe

- `50% -> 20%` est prepare et interpole dans `%`;
- `50px -> 20px` est prepare et interpole dans `px`;
- `50% -> 20px` est refuse avant le chemin chaud, lors de la preparation;
- aucune conversion automatique `percentage -> px` n'est ajoutee a ACE;
- une conversion eventuelle est une operation du materializer, apres resolution de
  la valeur logique;
- une valeur relative comme `+=8px` est resolue contre une base de meme unite, sans
  lire une valeur externe.
- un default d'identite comme `0` peut etre materialise dans l'unite explicite de
  l'autre borne lorsqu'il ne fait que representer l'identite; ce n'est pas une
  conversion d'unite de rendu.
- lorsqu'aucune borne deterministe n'est disponible, la resolution est differee a
  l'etat logique/runtime et ACE attend cette borne avant preparation.

À la frontière HTML, les valeurs numériques qui représentent des longueurs sont
converties en `px`. Cette conversion ne concerne ni les unités déjà portées par une
chaîne ni les longueurs présentes dans une chaîne `transform` brute. Le facteur
numérique, neutre à `1` par défaut, multiplie les valeurs numériques
juste avant leur écriture CSS. L'hôte le transmet avec `runner.resize(scale)`,
puis la frame courante est réappliquée sans compiler à nouveau la scène ni rejouer
les événements.

Cette frontière ne doit pas être utilisée pour requalifier un nombre unitless
éditeur : cette qualification a lieu une seule fois dans le circuit V2, avant la
résolution logique. Un resize ne modifie donc ni le nombre logique ni son unité.

Le chemin chaud ACE n'est donc pas prevu pour melanger deux unites. Le comportement
CSS, qui peut interpoler certaines unites heterogenes via le substrat, reste un
comportement de materialisation distinct et ne devient pas une capacite compilee.

### Utilisation au resize

Le calcul du zoom appartient à l'hôte qui connaît sa fenêtre ou son conteneur. Il
passe le facteur au runner, qui le transmet à son materializer HTML et réapplique
la frame courante :

```ts
const designWidth = 1440
// runner est construit avec le compiledScene, la racine et le catalog unifié.

function applyViewportZoom(): void {
  runner.resize(window.innerWidth / designWidth)
}

window.addEventListener('resize', applyViewportZoom)
applyViewportZoom()
```

Le facteur est donc une donnée runtime du materializer, pas une donnée de scène.
Avec un facteur `0.5`, `x: 40` reste `40` dans l'état logique puis devient `20px` à
l'écriture HTML. Une valeur déjà munie d'une unité, par exemple `x: '40px'`, et
une chaîne `style.transform` brute restent inchangées. L'hôte retire son écouteur
de resize lorsqu'il détruit le runner.

## Observation externe AnimeJS

AnimeJS est consulte uniquement pour comparer les proprietes de style CSS et la
decomposition portable `nombre + unite`. Les familles `OBJECT`, `ATTRIBUTE`, les
adapters runtime et les lectures de valeurs originales dans le DOM ne sont pas
importees dans le contrat V2 compile.

## Tests

Le contrat doit couvrir :

- preservation exacte de `number` et `unit`;
- interpolation dans une unite commune;
- refus des unites incompatibles;
- valeurs relatives avec unite;
- absence de conversion en `px` pendant le build, avec qualification contrôlée
  des longueurs unitless structurées du contrat éditeur V2;
- conversion eventuelle testee separement dans le materializer.
