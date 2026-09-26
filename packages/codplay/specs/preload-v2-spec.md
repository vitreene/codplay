# Preload V2 — service de préparation des ressources

## Périmètre certifié

Cette spécification ne décrit que les comportements couverts par les suites
citées ci-dessous. Les détails publics et les validations restantes sont suivis
dans le [plan média](../plan/media-preload-plan.md).

## Chargement et résultat

La façade `CodPlay` expose le service `preload`. Le chargement d'une image
attend `load`, puis attend `decode()` lorsque cette méthode est fournie. Les
stratégies peuvent retourner des métadonnées ; elles apparaissent dans le
résultat par URL. Les ressources chargées sont rendues dans l'ordre du
manifeste même si leurs stratégies finissent dans un ordre différent.

Le helper `mergeRuntimePreloadManifests()` fusionne un tableau de manifestes,
conserve l'ordre de première déclaration et déduplique par URL. Un type de
ressource personnalisé peut être traité par une stratégie fournie au
constructeur du service.

Si une ressource échoue, le mode par défaut `broadcast` retourne un résultat
réussi avec un avertissement ; en mode `author`, le résultat est un échec
`RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE`.

## Cache et transfert vidéo

Deux services qui partagent explicitement un cache partagent une même opération
de chargement en cours. Après succès, la première libération ne retire pas
l'entrée tant qu'un autre service en détient une référence ; la dernière
libération retire l'entrée.

La stratégie vidéo testée attend `canplaythrough` et conserve le nœud prêt. Elle
expose une lease permettant de récupérer ce même nœud ; libérer une lease non
adoptée retire le nœud préchargé. Le test de façade vérifie ensuite que
`resources.register()` permet au composant `media` d'adopter la node transférée.
Le cycle complet de nettoyage et de seek après adoption reste au plan.

## Canal CSS en mémoire

`preload.css.set()` applique synchroniquement une feuille limitée au conteneur
fourni. Remplacer le même slot met à jour la feuille sans accumulation. Un slot
peut être effacé individuellement ; `clear()` efface les slots du service et
peut être rappelé sans effet supplémentaire. La destruction de la façade
`CodPlay` retire ses slots CSS. Un identifiant de slot vide est refusé avant la
création d'une feuille.

Ce contrat concerne les feuilles CSS fournies en mémoire. Il ne certifie pas le
chargement d'une ressource CSS par URL.

## Preuves

- [`runtime-preload.spec.ts`](../tests/runtime/preload/runtime-preload.spec.ts)
  couvre l'image, `decode()`, l'ordre, les métadonnées, le cache partagé et les
  modes d'échec.
- [`preload-video-handoff.spec.ts`](../tests/runtime/preload/preload-video-handoff.spec.ts)
  couvre la conservation de la node vidéo et sa lease.
- [`preload-css-slot.spec.ts`](../tests/runtime/preload/preload-css-slot.spec.ts)
  couvre la portée, le remplacement, le nettoyage des slots et le refus d'un
  identifiant vide.
- [`media-preload-handoff.spec.ts`](../tests/facade/media-preload-handoff.spec.ts)
  couvre le transfert de la node retenue vers un composant média par la façade.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/preload/runtime-preload.spec.ts \
  tests/runtime/preload/preload-video-handoff.spec.ts \
  tests/runtime/preload/preload-css-slot.spec.ts \
  tests/facade/media-preload-handoff.spec.ts
4 fichiers, 14 tests réussis
```

## Limites de certification

La stratégie image, le transfert vidéo et le CSS en mémoire sont les seules
stratégies natives certifiées ici. Le timeout, `state`, `skipped`,
`registerStrategy()`, l'annulation concurrente, le nettoyage des handles par
`CodPlay.destroy()`, ainsi que les ressources `audio`, `font` et CSS par URL
doivent être validés séparément avant d'être décrits comme contrats. Ces gates
restent au plan média.
