# CodPlay V2 - valeurs numeriques et unites CSS

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before unit defaults

## Frontiere

La compilation ne convertit pas les unites. Elle conserve une valeur auteur dans
son unite semantique et transmet une forme preparee a ACE. La conversion vers une
unite de rendu, si elle est necessaire, appartient a `render`, car elle peut
dependre du substrat, du viewport, du parent ou du contexte de projection.

Le compile ne lit donc ni le DOM, ni les styles calcules, ni les dimensions du
viewport pour transformer `cqw`, `%`, `px` ou une autre unite.

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
- une conversion eventuelle est une operation de `render`, apres resolution de la
  valeur logique;
- une valeur relative comme `+=8px` est resolue contre une base de meme unite, sans
  lire une valeur externe.
- un default d'identite comme `0` peut etre materialise dans l'unite explicite de
  l'autre borne lorsqu'il ne fait que representer l'identite; ce n'est pas une
  conversion d'unite de rendu.
- lorsqu'aucune borne deterministe n'est disponible, la resolution est differee a
  l'etat logique/runtime et ACE attend cette borne avant preparation.

Le chemin chaud ACE n'est donc pas prevu pour melanger deux unites. Le comportement
CSS, qui peut interpoler certaines unites heterogenes via le substrat, reste un
comportement de projection distinct et ne devient pas une capacite compilee.

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
- absence de conversion pendant le build;
- conversion eventuelle testee separement dans `render`.
