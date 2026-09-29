# Layout partagé des démos Sighty

## Rôle

`src/sighty/layout/` compose la page commune des démos Sighty : en-tête,
sélecteur, scène, télécommande, journal et cycle de vie de la démo.

## Dimensions du cadre

`.sighty-layout` occupe toute la largeur disponible jusqu’à un maximum de
`1200px`. Ses marges horizontales automatiques le centrent lorsque le viewport
est plus large ; en dessous de `1200px`, le cadre suit la largeur disponible.
Il conserve sa hauteur pleine et son comportement de grille.

## Preuve navigateur

Le 2026-09-29, Firefox DevTools MCP a mesuré le cadre sur
`sighty.html?demo=demo5` : dans un viewport de `1366px`, sa largeur était de
`1200px`, avec `83px` de chaque côté ; dans un viewport de `1024px`, sa largeur
était de `1024px`, alignée sur les bords.
