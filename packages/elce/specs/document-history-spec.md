# Elcé — historique documentaire

## Statut

**En cours — circuit XState, interface et parcours courant vérifiés le
11 octobre 2026.** Les vérifications encore nécessaires figurent dans le
[plan Undo/Redo](../plan/2026-10-11-elce-undo-redo-plan.md).

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

## Preuves

- [`document-history.test.ts`](../src/app/history/document-history.test.ts)
  couvre le regroupement temporel et l’abandon de Rétablir.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  couvre l’ordre Section → page → Section, Undo/Redo, l’arrêt et le refus d’un
  import, ainsi que la fusion d’un doublon dans l’historique.
- [`document-persistence.test.ts`](../src/app/controller/document-persistence.test.ts)
  couvre la rétention des octets entre Annuler et Rétablir, leur libération,
  la limite de l’historique et la différence entre retour de focus inchangé et
  installation d’un autre document.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  couvre les boutons, le titre non validé, le raccourci synthétique Rétablir
  et le bouton distinct d’arrêt d’un import.
- Dans Safari Technology Preview, sur un projet d’essai supprimé ensuite,
  l’enchaînement texte Page A → créer Page B → texte Page B s’est annulé dans
  l’ordre inverse et a redonné le focus à la Section de Page A. Un titre non
  validé s’est annulé en un clic. Une illustration importée s’est retirée par
  Annuler puis réaffichée par Rétablir avec une image décodable. Le raccourci
  Undo a été vérifié par événement clavier synthétique ; la frappe physique
  reste au plan d’acceptation.
