# Méthodes d’élément HTML demandées par une action

## Frontière

`htmlElementMethod` est une donnée d’action conservée dans la scène compilée.
Le core CodPlay ne lui attribue aucune sémantique HTML : la projection la lit
dans les occurrences d’action résolues et applique la méthode au nœud courant du
perso dans le registre du materializer HTML. Aucun handle DOM ne traverse le
solveur et la valeur de retour n’est pas consommée.

## Formes prises en charge

Le materializer accepte uniquement les listes suivantes :

```ts
htmlElementMethod: ['focus']
htmlElementMethod: ['focus', 'preventscroll']
htmlElementMethod: ['blur']
```

Elles appellent respectivement `focus()`, `focus({ preventScroll: true })` et
`blur()` sur le nœud sélectionné. Toute autre forme est ignorée par la
projection. Elcé avertit l’auteur avant la compilation Sighty/CodPlay lorsque
la liste est invalide, répétée ou ambiguë.

## Activation, Seek et montage

La méthode est exécutée une fois lorsque l’occurrence apparaît dans la scène
présentée, sans répétition aux frames suivantes. Le materializer compare la
scène courante à la précédente pour reconnaître cette activation. Une action
déjà présente avant un refresh ne réexécute pas sa méthode.

Les phases génériques `geometry-capture`, Seek et reconstruction n’exécutent
aucune méthode. Le player transmet la phase de capture au materializer durant
Seek ; cette règle ne dépend pas du type de projection. Si le perso n’est pas
monté, la méthode est ignorée. Un élément présent mais non focalisable laisse
le navigateur appliquer le comportement de sa méthode native.

## Ordre synchrone des attributs et du focus

À l’ouverture, les changements d’attributs sont appliqués par le service HTML
avant l’appel de focus. À la fermeture, le materializer exécute d’abord le
focus de retour, puis valide `aria-hidden="true"` et `inert`. L’adaptateur
`attr` met ces deux écritures de fermeture en attente jusqu’à la fin du passage
synchrone du materializer. Cette capacité n’ajoute aucun scheduler RAF.

## Preuves

- [`html-element-method.spec.ts`](../tests/runtime/runner-html/html-element-method.spec.ts)
  exerce focus, blur, `preventScroll`, l’ordre focus/attributs, l’absence de
  répétition au refresh et l’absence d’effet pendant Seek.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  et [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  couvrent les frontières runner/player concernées.
- La validation auteur Elcé est couverte par
  [`html-element-method-validation.test.ts`](../../elce/src/builders/markup-validation/html-element-method-validation.test.ts).
