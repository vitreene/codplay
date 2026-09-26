# CodPlay V2 — frontière JSON de `CompiledScene`

## Périmètre vérifié

Cette spécification décrit la frontière de sérialisation JSON de l'artefact
`CompiledScene` qui est exercée par
[`codec.spec.ts`](../tests/scene/compiled/codec.spec.ts). Les règles de chaque
payload restent dans la spécification de la feature concernée ; le codec ne
remplace pas leurs contrats. La relation entre déclaration et compilation est
décrite dans la [spécification auteur de scène](./scene-authoring-spec.md).

## Enveloppe et round-trip

L'artefact testé contient `schemaVersion`, `createdAt`, `scene`, `resources`,
`rootNodeIds`, `requirements` et `actionTargetIndex`. L'index
`storyActivationIndex` est conservé lorsqu'il est présent. Le schéma courant
testé est `codplay.v2.scene.v1`.

`CompiledSceneCodec.encode()` produit une chaîne JSON pour un artefact valide ;
`decode()` la relit et retourne un résultat discriminé par `ok`. Le test de
round-trip vérifie que l'artefact relu conserve sa valeur et que l'objet racine
et `scene` sont gelés.

## Données conservées à la frontière

- Une relation compilée `rel` survit au round-trip comme donnée sérialisée, sans
  introduire de handle natif.
- Les références locales de straps et les noms réutilisables déclarés sur une
  story sont conservés.
- Une règle `listen` avec `active: true` et son index d'activation compilé sont
  conservés ensemble.

Ces assertions ne définissent pas les payloads de capture, d'observation ou de
composants. Elles doivent suivre les spécifications propres à ces features.

## Refus vérifiés

Le décodage échoue (`ok: false`) pour du JSON invalide, une version de schéma
différente de celle du codec, une relation avec un `host` vide, des racines
qui ne désignent pas un perso compilé, des actions propres au perso
sémantiquement incohérentes, des identifiants de perso dupliqués ou des
requirements de ressources incohérents avec le manifeste.

La migration entre versions de schéma ne fait pas partie du comportement testé.

## Preuves

- [`codec.spec.ts`](../tests/scene/compiled/codec.spec.ts) couvre le round-trip,
  le gel, les relations sérialisées, les straps locaux, l'index d'activation,
  les refus de JSON/version et les incohérences structurelles ou sémantiques
  listées ci-dessus.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run tests/scene/compiled/codec.spec.ts
1 fichier, 8 tests réussis
```
