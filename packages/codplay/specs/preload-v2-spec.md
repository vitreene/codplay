# Preload V2 — service de préparation des ressources

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre certifié

Cette spécification décrit le chargement, le partage de cache, le transfert
vidéo et le CSS en mémoire couverts par les suites citées ci-dessous. Le
chargement intégré des paquets, dont leurs médias et fontes locales, relève
de la [spécification du paquet de scène](./scene-package-export-v1-spec.md).

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
adoptée retire le nœud préchargé. Un handle ne transfère son nœud natif qu'une
fois ; un second `take()` ne fournit pas de lease. Le test de façade vérifie ensuite que
`resources.register()` permet au composant `media` d'adopter la node transférée.
Le réemploi des nœuds adoptés au Seek, au reset et au teardown est décrit par
les spécifications du [média](./media-sync-v2-spec.md) et du
[chargement de paquet](./scene-package-export-v1-spec.md).

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
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  couvre deux composants partageant une URL : une seule adopte la node du
  handle, l'autre conserve sa propre node vidéo persistante.

## Limites de certification

La stratégie image, le transfert vidéo et le CSS en mémoire sont les seules
stratégies natives certifiées ici. Le timeout, `state`, `skipped`,
`registerStrategy()`, l'annulation concurrente, le nettoyage des handles par
`CodPlay.destroy()`, ainsi que les ressources `audio`, `font` et CSS par URL
sont exclus du contrat isolé de ce service. Le parcours intégré des médias et
fontes de paquet possède son propre périmètre certifié dans la spécification
du paquet de scène.
