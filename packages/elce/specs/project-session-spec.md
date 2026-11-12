# Elcé — gestion de la session documentaire

## Rôle

La session de projet sélectionne le document auteur pour l’onglet actif. Le
catalogue appartient au mod de la route et reste distinct du catalogue de
contenus affiché dans l’éditeur. Le contrôleur XState reste l’unique
propriétaire du document, de la sélection et de l’accès d’édition.

## Routes et sélection

- `/` est l’entrée d’orientation et affiche le catalogue Learning par défaut.
  `/new` affiche le même sélecteur avec le formulaire de création. « Autre… »
  permet de choisir un mod et son type reste visible. Les catalogues Learning
  et Quiz Hunt sont chargés séparément par leurs API et filtres existants.
- `/learning/:documentId` et `/hunt/:documentId` choisissent la composition
  auteur et désignent le document. L’identifiant de route est prioritaire sur
  celui mémorisé dans `sessionStorage`. Le document doit exister dans le
  catalogue du mod demandé ; un identifiant absent affiche une erreur et ne
  restaure pas un autre document.
- `?mod=quiz-hunt` ne sélectionne plus la composition auteur. Les paramètres
  propres à la preview restent traités par son circuit de lecture.
- L’ouverture depuis un clic ou l’historique navigateur passe par la façade et
  le coordinateur de session du mod. L’acteur prépare la révision confirmée,
  synchronise le document courant, puis transfère le droit d’édition et installe
  le document cible avant de demander son verrou. Toute commande déjà acceptée
  finit son écriture locale avant la synchronisation. En cas d’échec ou de
  conflit, le document courant, son cache et son accès restent actifs.
- Le passage vers une composition d’un autre mod synchronise le document
  courant, libère son verrou et ses ressources d’édition, puis conserve sa copie
  IndexedDB confirmée. Une erreur garde la composition et la route courantes.
  Un seul acteur possède une session documentaire à la fois dans l’onglet.
- La création sur `/new` exige un nom. Le service documentaire du mod crée un
  document sous une identité neuve avec ce nom ; après confirmation serveur,
  son identifiant est ouvert dans la route correspondante. La vue ne crée pas
  un document provisoire pour le renommer ensuite.

## Cycle de vie et accès

- « Fermer » synchronise le document, libère son verrou et supprime sa copie
  IndexedDB. Le projet et son document restent sur le serveur.
- « Supprimer » demande confirmation et supprime d’abord le projet serveur.
  Pour le projet actif, son verrou et son cache IndexedDB sont retirés après la
  confirmation serveur. La suppression d’un autre projet ne touche pas l’accès
  actif ; elle prend d’abord son propre droit serveur.
- Si le cache local d’un projet serveur contient un format non pris en charge,
  l’application lit d’abord la version confirmée du serveur. Après cette
  lecture seulement, elle remplace le cache ciblé et son checkpoint. L’ancien
  cache n’est ni converti ni publié. Si la lecture serveur échoue, le cache et
  le catalogue sont conservés avec l’erreur. Cette récupération ne vise pas une
  copie locale indépendante absente du serveur.
- « Enregistrer sous… » crée une identité indépendante depuis le document
  confirmé affiché, sans modifier le projet source. La copie garde les
  identifiants de ses médias ; pour les fichiers absents localement, elle garde
  l’identité du projet source. Elle peut rester éditable hors connexion et
  publier ses médias à la reprise. Un média source introuvable laisse la copie
  locale en attente avec une indication explicite.
- Si la synchronisation du projet source échoue, « Enregistrer la copie locale
  sous… » peut conserver sous une autre identité son cache `pending` ou
  `conflict`, puis libérer le droit source sans publier l’ancienne valeur. La
  copie du serveur reste intacte. Cette action n’est proposée que lorsqu’une
  copie locale non confirmée existe. Une copie de secours rouverte sans focus
  affiche son contenu en lecture seule jusqu’à l’acquisition de l’édition.
- Chaque onglet mémorise son projet actif séparément. Le verrou local exclut
  l’édition concurrente entre fenêtres du profil ; le droit serveur exclut une
  seconde édition entre navigateurs. Le coordinateur récupère la révision
  confirmée au retour du focus, selon la
  [spécification d’accès par fenêtre](./editor-window-access-spec.md).
- Une page lectrice permet de réessayer l’accès ou de le forcer selon le
  mécanisme prévu. Le forçage remplace le droit serveur puis installe la révision
  confirmée dans le même acteur avant de réactiver les commandes ; il ne crée
  pas une copie des changements locaux non confirmés.

## Circuit

Les intentions de gestion passent de l’application Remix à la façade commune,
puis à l’événement `project.operation` du même acteur XState. Le
`ProjectSessionCoordinator` raccorde cet acteur à l’API, au cache, à la
synchronisation et au verrou ; il ne possède pas de document éditorial
parallèle. Chaque composition fournit son propre store, son transport, son
codec et son catalogue de mod.

- [`browser-entry.tsx`](../src/app/remix/browser-entry.tsx) et
  [`remix-spa-router.tsx`](../src/app/remix/remix-spa-router.tsx) résolvent les
  routes et montent la composition auteur ou preview correspondante.
- [`project-application.tsx`](../src/core/authoring/layout/project-application.tsx)
  rend le sélecteur superposé, le formulaire nommé et les actions d’ouverture
  et de suppression. Il utilise
  [`CoreEditorFacade`](../src/core/authoring/core-editor-facade.ts), qui envoie
  les intentions au contrôleur propriétaire.
- [`controller-machine.ts`](../src/core/controller/controller-machine.ts)
  sérialise les opérations et installe le document reçu avant de demander son
  verrou.
- [`project-session-coordinator.ts`](../src/core/projects/project-session-coordinator.ts)
  coordonne l’API, le cache, la synchronisation et le verrou à travers les
  services injectés. Les compositions Learning et Quiz Hunt fournissent leurs
  propres stores et coordinateurs de mod.

## Tests de référence

- [`elce-authoring-routes.test.ts`](../src/app/remix/elce-authoring-routes.test.ts)
  couvre la résolution des routes et le choix du mod.
- [`remix-spa-router.test.ts`](../src/app/remix/remix-spa-router.test.ts)
  couvre les routes SPA et la séparation de la preview.
- [`learning-project-application.test.tsx`](../src/mods/learning/authoring/learning-project-application.test.tsx)
  couvre le sélecteur superposé et la création nommée.
- [`project-session-coordinator.test.ts`](../src/mods/learning/integration/project-session-coordinator.test.ts)
  et [`project-operations.test.ts`](../src/mods/learning/integration/project-operations.test.ts)
  couvrent la synchronisation, la création nommée, l’ouverture demandée, la
  conservation de la session après erreur et la libération inter-mod via le
  même acteur.
