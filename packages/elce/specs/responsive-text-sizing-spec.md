# Elcé — formule de taille responsive du texte

## Statut

**Vérifiée pour le texte documentaire des BDC.** Cette spécification isole la
mesure en fonction du conteneur pour qu’elle puisse être référencée par d’autres
surfaces. Seules les applications décrites dans la spécification d’apparence
sont actuellement validées.

## Formule du corps

La taille du texte courant est le maximum entre un plancher de lisibilité et une
fraction de la largeur du conteneur :

```text
font-size = max(plancher, 2.76cqi)
```

`cqi` vaut un centième de la largeur logique (`inline-size`) du conteneur de
requête le plus proche. La même formule peut s’écrire `max(plancher, 0.0276 × W)`,
où `W` est cette largeur. Le plancher dépend de la densité :

| Densité | Plancher |
| --- | --- |
| Aucune, Compacte ou Normale | `0.9rem` |
| Large | `0.95rem` |

Dans Elcé, `.bdc` est le conteneur de requête (`container-type: inline-size`) et
sa largeur maximale est `min(100%, 55rem)`. La formule s’applique à son contenu.
Elle ne plafonne pas la taille du texte : celle-ci continue de croître tant que
le conteneur s’élargit. La borne de largeur appartient au conteneur, pas à la
formule typographique.

## Titres

Les titres H1–H6 gardent une échelle distincte par niveau. Pour chaque niveau
`n`, son minimum et son coefficient responsive sont multipliés par `1.41` :

```text
font-size(Hn) = 1.41 × max(minimum(Hn), coefficient(Hn) × cqi)
```

La hiérarchie H1–H6 est donc conservée ; il ne faut pas remplacer leurs
coefficients par celui du corps. Les titres dédiés du lecteur gardent leurs
échelles de composant documentées dans
[`appearance-spec.md`](./appearance-spec.md).

## Cible et limites

Le coefficient `2.76` vise environ 60–85 caractères par ligne en moyenne quand
la largeur le permet. C’est une cible de lecture, pas une garantie indépendante
de la fonte ou du contenu. Quand le conteneur est étroit, le plancher prévaut et
les lignes peuvent contenir moins de 60 caractères ; les retours se font
naturellement. La formule ne mesure pas les lignes en JavaScript.

Sur la preview Demo5, un long texte atteint 76,9 caractères par ligne en
moyenne à la borne de `55rem`. La calibration des autres fontes, contenus et
BDC reste suivie dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).

## Réutilisation

Pour appliquer cette mesure à un autre texte, le conteneur dont la largeur doit
piloter la taille établit `container-type: inline-size`; la formule est ensuite
appliquée à son contenu. Le plancher reste un choix explicite du contexte, et la
limite de largeur demeure séparée de la taille de police. L’application à une
nouvelle surface doit être ajoutée à la spécification qui décrit cette surface.

Les règles Elcé sont portées par
[`reading.css`](../src/config/appearance/css/typography/reading.css) et la
feuille Large par
[`large.css`](../src/config/appearance/css/densities/large.css).
[`appearance-scene-style-sheet.test.ts`](../src/player/appearance-scene-style-sheet.test.ts)
vérifie la mesure des BDC, le plafond du conteneur et les planchers de densité.
