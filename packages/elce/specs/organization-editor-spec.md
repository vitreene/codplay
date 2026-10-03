# Elcé — organisation et titres dans l’éditeur

## Statut

**Fixe — actions de création et édition centrale des titres implémentées et
vérifiées en test et dans Safari. La restauration des titres après rechargement
reste dans le plan de l’organisation du scénario.**

Cette spécification décrit les commandes visibles pour créer des pages et des
chapitres, ainsi que l’édition de leurs titres dans la zone centrale.

## Contrat

Les actions « Ajouter un chapitre » et « Ajouter une page » sont des boutons
Lucide sans libellé visible, avec nom accessible et infobulle. L’ajout d’une
page utilise la commande `page.create` sans nom fourni : la page reçoit donc le
prochain nom automatique et devient la page sélectionnée.

Dans la zone centrale, le titre de la page sélectionnée est éditable. Si cette
page appartient à un chapitre, le titre de ce chapitre apparaît au-dessus et
est éditable lui aussi. Une page à la racine du scénario ou dans le catalogue
n’affiche pas de titre de chapitre.

Les champs de titre gardent leur saisie dans le DOM pendant l’édition. Le
changement est envoyé au contrôleur XState à la perte de focus ou avec Entrée,
par `document.apply` et la commande `page.rename` ou `chapter.rename`. Les
espaces de bord sont retirés ; si le nom est vide, l’ancienne valeur est remise
dans le champ et aucune commande n’est envoyée. Le modèle met à jour son nom
sans changer les identifiants, l’ordre, l’affectation ou les BDC. La liste à
gauche lit les noms actualisés depuis le document détenu par XState.

## Preuves

- [`AppLayout.test.tsx`](../src/app/layout/AppLayout.test.tsx) vérifie que les
  boutons d’ajout sont iconiques et accessibles, que l’ajout d’une page garde
  son nom automatique, et que l’édition centrale met à jour les noms dans le
  document XState et dans la liste du scénario.
- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie le renommage immuable et le refus d’un nom vide.
- Safari MCP sur l’application Elcé confirme l’affichage des deux icônes et
  des champs de titre de page et de chapitre dans la zone centrale.
