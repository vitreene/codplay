# Elcé — cache documentaire IndexedDB

## Rôle et contrat

`IndexedDbDocumentStore<TDocument>` conserve dans IndexedDB les documents locaux,
les blobs média et le checkpoint de synchronisation de chaque projet. Il reçoit
un `DocumentStoreCodec<TDocument>` qui définit la lecture, l’écriture, l’identité
documentaire et les identifiants média ; le stockage n’importe pas le modèle
Learning.

Le store utilise trois object stores partagés : `documents` et `media` sont
indexés par `id`, `sync` par `documentId`. Enregistrer un document remplace
uniquement son cache, marque son checkpoint `pending`, conserve la révision
distante et l’état `conflict`, et filtre les médias déjà confirmés pour ne garder
que ceux encore référencés. Les écritures du document, du checkpoint et des
médias retirés sont transactionnelles.

Supprimer un document retire son checkpoint et ses blobs non partagés ; les
médias encore référencés par tout autre cache sont conservés. Le nettoyage
`deleteOrphanedMedia()` supprime les blobs absents de tous les documents en
cache. Pour ce nettoyage et la suppression partagée, l’enregistrement sérialisé
expose `id` et `medias[].id`, indépendamment de sa version métier. Les octets
confirmés peuvent être retirés par `deleteMedia()` sans réécrire le document.

L’adaptateur Learning `learningDocumentCodec` relie le store au modèle v7. Les
autres compositions peuvent fournir leur propre codec et partager le même
contrat de persistance technique.

## Invariants

- Le store ne possède ni ne valide le modèle métier ; seul son codec le lit et
  l’écrit.
- Un projet et son checkpoint sont adressés par le même identifiant de document.
- `deleteDocument()` et `deleteOrphanedMedia()` conservent les médias référencés
  par un autre document local.
- Un enregistrement local ne remplace pas une révision distante connue et ne
  transforme pas un conflit en état `pending`.

## Vérification

- [`document-store.test.ts`](../src/mods/learning/integration/document-store.test.ts)
  vérifie le codec Learning, la conservation des médias partagés, les
  checkpoints et le nettoyage des blobs orphelins.
- Safari MCP (`http://localhost:5175`) a créé une base temporaire indépendante
  avec un codec document `{ id, title, medias }`. Le parcours a vérifié le
  round-trip du codec, le checkpoint de révision 7 et l’état `pending`, la
  suppression d’un média non référencé, la conservation d’un média partagé et
  son nettoyage après suppression du dernier document. La base temporaire a
  été supprimée après le contrôle.
