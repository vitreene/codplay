# Elcé — historique documentaire

## Rôle et contrat vérifié

Le contrôleur XState possède un seul historique pour le document. Les commandes
documentaires, les éditions de Section et les imports acceptés sont validés dans
leur ordre d’arrivée ; une commande de page ne dépasse pas une édition de texte
encore en traitement. Chaque geste réussi conserve les états documentaires avant
et après ainsi que la page sélectionnée. Annuler remonte cet ordre ; Rétablir le
rejoue ; une nouvelle édition après Annuler abandonne Rétablir. L’historique,
limité à 100 gestes, reste dans la session et est vidé au changement de projet
ou à l’installation d’un document différent. Restaurer une copie locale
identique au retour du focus le conserve.

Les saisies rapprochées dans un même champ sont regroupées pendant 500 ms. Les
transactions Tiptap transmettent les positions de sélection avant et après
l’édition ; une navigation Undo/Redo vers une Section d’une autre page remonte
cette page et restaure la sélection dans l’éditeur. L’historique Tiptap local
reste désactivé. Les boutons de l’en-tête et les événements clavier
Ctrl/Cmd+Z et Ctrl/Cmd+Shift+Z appellent le même contrôleur. Pour un titre de
page ou de chapitre encore saisi mais non validé, Annuler valide d’abord le
champ par son blur puis annule ce titre en priorité.

Un import réussi ajoute sa ressource et son usage dans un seul geste. Annuler
retire la ressource nouvellement créée du document ; Rétablir la rétablit. Le
blob local reste disponible tant que l’historique peut en avoir besoin ; il est
libéré si la branche Rétablir est abandonnée ou si le geste sort de la limite
de 100 entrées. Un bouton séparé « Annuler l’import » interrompt une écriture
locale encore en cours sans consommer un geste Undo ; sa copie provisoire est
nettoyée après l’arrêt du worker. Un refus du stockage nettoie également cette
copie sans modifier le document ni l’historique. Quand le serveur signale un
média déjà présent, `media.merge` réécrit les états concernés de l’historique
au lieu de devenir un geste auteur supplémentaire.

Déposer un fichier image sur l’aperçu d’une Carte ancrée remplace la ressource
de cette Carte par le même circuit d’import et forme un seul geste documentaire.
Annuler restaure l’ancien média sur le même BDC ; Rétablir remet le nouveau.
Le recalcul du ratio de réservation de l’ancre après chargement est une
conséquence de l’import et ne crée pas une entrée séparée. Un dépôt sans cible
valide ne modifie ni document, ni média, ni historique.

À chaque démarrage de l’éditeur, le store IndexedDB supprime les blobs qui ne
sont référencés par aucun document local. Les médias encore référencés par un
autre cache projet sont conservés. Ainsi, une image retirée par Undo reste
rétablissable pendant la session courante, mais ses octets ne sont pas gardés
après un rechargement si aucun document local ne les référence.

`DocumentHistory<TDocument, TSelection>` dans `core/history/` contient la
politique commune de regroupement, de branche Annuler/Rétablir et de limite
d’historique. L’acteur Learning lui fournit la fusion métier des documents et
conserve la sélection de page dans le même historique ; il n’existe pas de
second acteur pour l’historique.

## Preuves

- [`document-history.test.ts`](../src/mods/learning/integration/document-history.test.ts)
  couvre le regroupement temporel et l’abandon de Rétablir.
- [`controller-machine.test.ts`](../src/mods/learning/integration/controller-machine.test.ts)
  couvre l’ordre Section → page → Section, Undo/Redo, l’arrêt et le refus d’un
  import, ainsi que la fusion d’un doublon dans l’historique.
- [`document-persistence.test.ts`](../src/mods/learning/integration/document-persistence.test.ts)
  couvre la rétention des octets entre Annuler et Rétablir, leur libération,
  la limite de l’historique et la différence entre retour de focus inchangé et
  installation d’un autre document.
- [`document-store.test.ts`](../src/mods/learning/integration/document-store.test.ts)
  vérifie que le nettoyage garde les médias utilisés par n’importe quel cache
  projet et retire les blobs orphelins.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  couvre les boutons, le titre non validé, le raccourci synthétique Rétablir
  et le bouton distinct d’arrêt d’un import.
- Dans Safari Technology Preview, sur un projet d’essai supprimé ensuite,
  l’enchaînement texte Page A → créer Page B → texte Page B s’est annulé dans
  l’ordre inverse et a redonné le focus à la Section de Page A. Un titre non
  validé s’est annulé en un clic. Une illustration importée s’est retirée par
  Annuler puis réaffichée par Rétablir avec une image décodable. Le raccourci
  Undo a d’abord été vérifié par événement clavier synthétique.
- Le test manuel de l’interface a ensuite confirmé les boutons Annuler,
  les raccourcis clavier physiques, l’annulation d’une image et la purge des
  blobs orphelins après rechargement.
- Safari MCP sur `5175` a modifié le titre d’une page dans un projet temporaire,
  puis utilisé Undo et Redo réels. Les sauvegardes `PUT /document` ont répondu
  `200` ; après rechargement, le titre rétabli par Redo était présent (`GET 200`).
  Le projet d’essai a ensuite été supprimé.
- Le 28 octobre, sur `localhost:5175` dans Safari MCP, Undo puis Redo ont aussi
  restauré une édition de texte dans une Section, la création d’une page et un
  titre de page non validé. Le statut était « Synchronisé » pendant ces parcours.
- Le 28 octobre, sur la Carte ancrée de Page D MCP dans Safari (`5175`), un
  fichier déposé par événement `drop` synthétique remplace le média du même
  BDC. Un Annuler restaure l’ancienne ressource et un Rétablir la nouvelle,
  chacun en un geste ; les sauvegardes `PUT /document` répondent `200`. Un
  dépôt sans position valide ne change pas le document ni l’historique et ne
  produit aucune requête de sauvegarde. Le projet a été remis à l’image
  originale puis rechargé.
