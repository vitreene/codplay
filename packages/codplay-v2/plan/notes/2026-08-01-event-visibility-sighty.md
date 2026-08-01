# Visibilite des events pour Sighty

## Statut

Contrainte de conception active. Le comportement general est acquis, mais le nom
final et l'API Sighty restent a relire avant de devenir un contrat V2.

## Decision

V2 ne porte pas le booléen V1 `cascade`. Il est insuffisant pour les plans avec
Sighty et mélange exposition d'un event et transport vers un destinataire.

La direction de travail est une visibilité nommée :

```text
visibility: story | scene | public
```

## Semantique

- `story` : l'event reste dans la story qui le produit;
- `scene` : l'event devient visible au niveau de la scene;
- `public` : l'event sort de la scene et devient observable par l'hôte ou Sighty.

`public` ne désigne pas une autre scene et ne déclenche aucun transport CodPlay
scene-vers-scene. Sighty ou l'application hôte décide de ce qu'elle fait de cette
sortie.

La visibilité nomme donc une exposition, pas une cascade, une diffusion ou un
broadcast.

## Invariants

- CodPlay ne route pas directement un event vers une autre scene;
- une transform ne modifie pas `visibility`;
- l'event conserve sa provenance et son scope d'origine;
- la visibilité est résolue avant la projection vers l'hôte;
- les events internes ne deviennent pas publics par défaut.

## Consequence actuelle

Les contrats V2 d'event, listen, emit et Sighty ne doivent pas introduire
`cascade: boolean`. Ils doivent rester compatibles avec une future visibilité
nommée. Le runtime V1 reste l'oracle comportemental pour les deux niveaux existants,
mais son booléen n'est pas repris comme représentation V2.
