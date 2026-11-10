# Stabilisation V2 — média et preload

> Statut : En cours. Les contrats vérifiés sont dans les spécifications
> [preload](../specs/preload-v2-spec.md), [média](../specs/media-sync-v2-spec.md)
> et [paquet](../specs/scene-package-export-v1-spec.md).

## Périmètre

Fermer les défauts et preuves manquantes du preload, de son handoff et du
cycle natif déjà exposés. Les sources directes, nouvelles commandes vidéo et
relations d’horloges tierces sont séparées dans les
[évolutions à affecter](./evolutions/evolution-backlog.md).
Les contrats de diffusion V1 et `media.sync` déjà vérifiés ne sont pas à réimplémenter.

## Isolation des vidéos futures avant activation

Défaut runtime ouvert, distinct de l’export terminé. Après `load()`, une vidéo
future préchargée peut rester visible dans `document.body`, hors du root.
Le cas est reproduit avec deux occurrences et par l’échec attendu de
[`scene-package-export-acceptance.spec.mjs`](../tests/facade/scene-package-export-acceptance.spec.mjs).

Cause identifiée : `MediaComponent.ensureStaticSourceNodes()` adopte chaque
handle et efface son style de preload. Seule la source active est rattachée au
composant ; la source future conserve son parent de preload. Le handoff et
la propriété du nœud dans `MediaComponent` sont la frontière à examiner.

L’utilisateur a exclu ce correctif du chantier d’export. Sa réalisation exige
une analyse et un plan acceptés, une autorisation explicite du cœur et un
commit distinct. Aucun adaptateur export ni changement local de démo ne doit
masquer le défaut.

Acceptation à conserver pour ce correctif :

- source initiale et future préparées, sans vidéo visible hors du root ;
- une puis deux occurrences, montage et activation future ;
- identité des nœuds, source et absence de nouvel appel natif `load()` ;
- Seek avant/arrière, reset/replay, arrêt et destruction, sans fuite ;
- parcours auteur et diffusion avec leurs vrais handoffs, puis navigateur.

## Preuves de service restantes

- [ ] État et compteurs d’une opération, résultat `skipped` sur cache prêt,
      timeout par ressource et valeur par défaut.
- [ ] `cancel()` pendant un chargement partagé sans interrompre l’autre
      propriétaire, et annulation par `CodPlay.destroy()`.
- [ ] Nettoyage des handles média adoptés ou non adoptés à la destruction.
- [ ] Chemin public `registerStrategy()` et stratégies natives audio, font
      et CSS par URL. Distinguer le contrat isolé du service des parcours de
      paquet déjà certifiés par la spécification de diffusion.
- [ ] Handoff suivi de Seek et teardown sans nouveau chargement natif.

## Acceptation Safari du handoff

- [ ] Première frame visible avant Play après adoption de la vidéo préparée.
- [ ] Lecture, pause, Seek puis reprise avec le même nœud, sans réassignation
      identique de `src` ni appel natif `load()` redondant.
- [ ] Déterminer la cause de l’échec de nouvelle initialisation Safari : la
      sonde du 9 octobre renvoie un timeout de 10 s, malgré HTTP 200 et Range
      206 ; le nœud reste à `readyState=0`, `networkState=3`, sans `currentSrc`
      ni événement de disponibilité. Un onglet déjà préparé garde une vidéo
      prête. Ne pas contourner le preload par `broadcast` ou un chemin HTML.

Mesurer les dérives natives éventuelles pendant ces parcours. Une politique
nouvelle de correction relève des évolutions séparées ; elle n’est pas un
contrat certifié du service.

## Clôture

Fermer les preuves de service, l’isolation des vidéos futures et le parcours
Safari réel avant de retirer le plan. Le raccord Elcé et ses commandes de
sortie utilisent leurs spécifications applicatives ; une difficulté locale
ne suffit pas à autoriser une modification du cœur partagé.
