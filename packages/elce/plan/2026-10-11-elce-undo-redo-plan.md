# Elcé — intégrer Annuler et Rétablir

**Statut : En cours — décisions validées, circuit principal intégré ;
acceptation complète encore ouverte.** Le
[modèle documentaire](../specs/document-model-spec.md),
l'[édition de Section](../specs/section-editor-spec.md) et l'[accès au projet](../specs/editor-window-access-spec.md)
décrivent les circuits vérifiés à prolonger.

## Résultat attendu

Un seul historique suit l'ordre des gestes éditoriaux, quel que soit le champ
ou la page. Après « modifier un texte → déplacer une page → modifier un texte »,
trois Annuler remontent ces gestes dans l'ordre inverse. Rétablir les rejoue
dans l'ordre initial. Une nouvelle modification après Annuler abandonne la
branche Rétablir.

Le contrôleur XState reste propriétaire du document et de l'historique. Tiptap
reste la surface de saisie ; son Undo local ne crée pas une seconde chronologie.
Les éditions de texte rapprochées forment un geste, séparé après environ 500 ms
ou un changement de champ. Annuler un texte situé ailleurs ouvre sa page et
replace le curseur dans la Section concernée.

L'historique ne persiste pas : recharger la page, changer de projet ou installer
une version serveur plus récente le vide. Au démarrage après un rechargement,
les blobs média sans référence dans aucun document local sont supprimés ; les
médias encore référencés par un cache projet sont conservés. Les boutons
globaux et les raccourcis Ctrl/Cmd+Z et Ctrl/Cmd+Shift+Z utilisent le même
circuit. La validation à deux
navigateurs doit vérifier explicitement que recevoir la version du navigateur
de contrôle vide l'historique du navigateur piloté.

## Travail et critères de sortie

1. [x] **Ordonner les gestes.** Faire entrer les commandes documentaires et les
   modifications asynchrones de Section dans un ordre unique de validation,
   sans second propriétaire du document. Prouver le parcours texte → page →
   texte, y compris quand un travail asynchrone est encore en cours.
2. [ ] **Ajouter l'historique documentaire.** Capturer uniquement les mutations
   réussies, regrouper la saisie, restaurer page et sélection, vider Rétablir
   après une nouvelle édition et effacer l'historique aux frontières de projet,
   de rechargement et de remplacement serveur. Borner l'historique à 100 gestes
   et libérer les médias des entrées évincées. Vérifier Undo/Redo de créations,
   déplacements, suppressions, titres, réglages, Sections et ancres.
3. [x] **Inclure les imports de fichiers.** Un import réussi est un seul geste
   annulable : Annuler retire sa nouvelle ressource du catalogue, Rétablir
   retrouve ses octets pendant cette session. Préserver les médias partagés et
   intégrer une éventuelle déduplication serveur au même résultat éditorial.
   Garder les octets nécessaires tant que Rétablir est possible, puis libérer
   cette rétention. Si le stockage refuse l'import, nettoyer sa copie
   provisoire, laisser le document intact et ne créer aucune entrée d'historique.
   Sur une image d'un BDC ancré, remplacer le média du même BDC dans ce geste ;
   Undo restaure l'ancien média et Redo le nouveau. Un dépôt de fichier hors de
   l'éditeur ou sans position métier valide est consommé sans ouvrir le fichier
   ni modifier document ou historique. Le 28 octobre, les tests ciblés (57
   tests sur sept fichiers), le typecheck, le build et Safari MCP (`5175`)
   valident le remplacement d’une Carte ancrée, un seul Undo/Redo et le rejet
   hors cible sans navigation ni sauvegarde ; preuves dans les spécifications
   Ancre, Section et Historique.
4. [x] **Permettre l'arrêt d'un import en cours.** Un bouton explicite
   « Annuler l'import » interrompt immédiatement la préparation du fichier,
   nettoie ses données provisoires et ne déclenche pas l'Undo d'un geste
   antérieur. Une fois l'import validé localement, l'Undo documentaire prend le
   relais, même si la synchronisation réseau continue.
5. [x] **Raccorder l'interface.** Afficher des boutons globaux Annuler/Rétablir
   avec leur disponibilité réelle. Router les raccourcis depuis les surfaces
   Tiptap et les champs natifs vers ce même circuit, sans double annulation.
   L'utilisateur a vérifié les boutons et les raccourcis clavier réels.
6. [ ] **Terminer l'acceptation.** Vérifier dans l'interface les autres
   commandes structurelles et réglages, l'accès suspendu et les changements de
   projet. Tester le transfert entre deux navigateurs et le nettoyage quand
   plusieurs onglets partagent IndexedDB. Le 28 octobre, Safari MCP a aussi
   vérifié le cycle d’une image importée et téléversée (`PUT /document` `200`,
   upload média `201`, Undo puis Redo sur la même Carte). Mettre à jour les
   spécifications propriétaires après vérification des comportements restants.
   **Contrôle du 28 octobre :** les tests dans `packages/elce` passent pour
   370 tests sur 371, sur 46 fichiers ; l’unique échec est le serveur SQLite
   de test bloqué par `listen EPERM: operation not permitted 127.0.0.1`. Trois
   suites supplémentaires (verrou projet, client API, placement) passent
   16 tests. Dans Safari MCP, sur `localhost:5175`, l’interface a vérifié le
   Undo/Redo d’une édition de Section, de la création d’une page et d’un titre
   de page encore saisi. Les commandes, réglages et frontières projet restent
   à exercer dans l’interface ; le glisser-déposer est hors périmètre de ce
   contrôle, conformément à la demande utilisateur. Le projet temporaire
   `Projet 3` créé pour ce contrôle est toujours ouvert dans l’éditeur. Safari
   MCP rapporte `Lecture seule`, `document.hasFocus=false` et un onglet inactif ;
   la suppression par l’interface est donc refusée. Ce statut concerne l’accès
   d’écriture, pas l’ouverture du projet. Reprendre sa suppression et les
   parcours navigateur quand l’accès d’édition est disponible. Le transfert
   entre navigateurs n’est pas couvert par l’inventaire MCP de cette session.

## Saisie non encore validée

Les titres de page et de chapitre ne sont aujourd'hui validés qu'à la sortie
du champ. Si Annuler est demandé pendant une saisie non encore validée, valider
ce titre puis annuler ce geste en priorité ; ne pas remonter à une action
documentaire antérieure. Ce comportement a été retenu avant le raccord des
raccourcis.

## État d’acceptation du 11 octobre 2026

L’ordre Section → page → Section, le retour entre pages, le titre non validé,
les boutons et l’import d’illustration avec Annuler/Rétablir ont été exercés
dans Safari sur un projet d’essai supprimé ensuite. L'utilisateur a également
validé les raccourcis clavier physiques, l'annulation d'une image et la purge
des blobs orphelins après rechargement. Les tests ciblés couvrent l’arrêt d’un
import pendant l’écriture, le quota, la rétention des octets, la limite de 100
gestes, la fusion d’un média doublon, la conservation de l’historique au retour
de focus inchangé et le choix des blobs à purger. La
[spécification de l’historique](../specs/document-history-spec.md) décrit ces
comportements vérifiés.

Restent à valider avant de clore : les autres commandes structurelles et champs
de réglage dans l’interface, l’accès suspendu et les changements de projet,
le transfert entre deux navigateurs et l'effet du nettoyage partagé entre
plusieurs onglets. La suite Elcé présente sept
échecs préexistants du player ; le test SQLite/API passe avec accès au port
local, comme avant cette tranche.

## Décision validée : octets après rechargement

Les blobs conservés uniquement pour Rétablir ne survivent pas au rechargement.
Au démarrage, balayer les médias en IndexedDB et supprimer ceux qui ne sont
référencés par aucun document local. Cette règle laisse intacts les documents
et médias encore présents dans les caches projet. La purge après rechargement
a été validée par l'utilisateur. Le comportement entre plusieurs onglets reste
à valider, car IndexedDB est partagé entre eux.
