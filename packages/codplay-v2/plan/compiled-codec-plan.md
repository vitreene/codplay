# CodPlay V2 - codec CompiledScene

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: enveloppe structurelle validée le 2026-08-20; validation sémantique et migrations restent ouvertes

## Role

Le codec est la frontiere entre un artefact `CompiledScene` en memoire et sa forme
JSON de diffusion. Il ne consomme ni `SceneDoc`, ni catalogue de composants, ni
DOM, ni engine, ni player.

```text
CompiledScene -> encode -> JSON
JSON          -> decode -> CompiledScene immutable
```

La collection de fonctions extraite par le builder reste externe au JSON. Le codec
ne serialise jamais une fonction et ne resout jamais une `CompiledFunctionReference`.

## Encode

`encode` accepte un `CompiledScene` deja produit par le builder et retourne un JSON
UTF-8 textuel. Il ne complete aucun champ, ne convertit aucune unite et ne parse
aucune valeur CSS. Les valeurs compilees doivent deja etre JSON-compatibles.

Une fonction presente par erreur dans l'artefact est une violation de contrat de
build, pas une valeur a supprimer silencieusement par `JSON.stringify`.

## Decode

`decode` accepte un texte JSON et retourne soit un artefact valide, soit un rapport
de diagnostics bloquants. Il valide :

- `schemaVersion` contre la version supportee;
- `createdAt` et les champs de l'enveloppe;
- `scene`, stories, persos, actions, listen et eventimes;
- les `CompiledFunctionReference` et l'absence de fonctions reelles;
- le manifeste de ressources et ses policies;
- `rootNodeIds`;
- `requirements` et ses tableaux de capacites.

Les valeurs recursives autorisees sont les primitives JSON, les tableaux, les
records et les references de fonctions de forme `{ ref: string }`. Une valeur
`Date`, `Map`, `Set`, fonction, `undefined` ou instance de classe est rejetee.

Le decode ne valide pas que les composants, services, modules ou ressources sont
disponibles. Cette verification appartient a l'engine et au chargement, pas au
codec structurel.

## Version et extensions

Le decoder ne devine pas une version et ne convertit pas une ancienne enveloppe.
Une version inconnue est bloquante et doit etre traitee par un codec dedie.
Les champs inconnus de l'enveloppe sont rejetes; les records de donnees internes
restent ouverts selon leur contrat de service.

## Immutabilite

Un artefact decode est finalise immutable avant d'etre retourne. Le freeze est une
garantie de la frontiere de diffusion, distincte du snapshot interne du catalogue
de validation, qui reste une copie TypeScript `ReadonlyMap` sans freeze profond.

## Hors perimetre

- sanitation de `SceneDoc`;
- defaults de propriete;
- parseurs couleur et transform;
- conversion d'unites;
- resolution de `from` runtime;
- verification de capacites disponibles;
- execution de fonctions externes;
- lecture ou ecriture DOM.
