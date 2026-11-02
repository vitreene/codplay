# Integration de Mods dans `elce`

**Statut : Fini dans la copie intégrée.** Les 85 chemins en conflit ont été
résolus par propriétaire ; la base `elce` est conservée. La suite complète,
le typecheck, le build et les parcours navigateur décrits ci-dessous passent.
Le plan Variables et liens reste `En cours` pour les champs et formats au-delà
du parcours de fusion validé ici.

## Décisions retenues

- Garder `elce` comme base du résultat et `origin/elce-mods` comme apport
  architectural.
- Choisir la base de données après comparaison du schéma, des migrations et des
  données ; prévoir une migration uniquement si la base la mieux adaptée ne peut
  pas être conservée telle quelle.
- Porter les comportements de `elce` dans les nouveaux propriétaires en
  suivant les spécifications vérifiées ; ne pas choisir globalement un côté
  pour résoudre les conflits.
- La source Mods n’a aucun changement sous `packages/codplay` depuis
  l’ancêtre commun ; garder les changements CodPlay déjà portés par `elce`.
- Le modèle Learning v7 de la source Mods est le nouveau propriétaire du
  document, mais la fusion conserve le contrat Elce v9 et sa migration v7 → v9.
  Préserver les étiquettes, les liens et dates, la sortie anticipée,
  l’historique, la session Preview et sa synchronisation automatique.
- Garder les ressources réutilisables indépendantes de Learning ; fournir les
  comportements profil et inline-text par les contributions du mod existant.
- Pour les champs ordinaires, étendre le point d’injection auteur des ressources :
  Learning fournit l’éditeur Tiptap à promotion paresseuse, tandis que les
  ressources gardent leur rendu natif par défaut et leurs commandes métier.
- Les réponses du Quiz restent des libellés texte simples, sans étiquettes ni
  autres enrichissements ; garder le rendu et le nom du choix dans l’Input
  existant, sans modifier CodPlay.
- Les titres de page et de chapitre suivent la synchronisation immédiate : une
  valeur non vide est appliquée pendant la saisie, les changements groupés dans
  une seule étape d’historique, et un titre vide retrouve sa dernière valeur
  valide à la sortie du champ.

## Comparaison des bases — 2026-11-02

Les deux bases ont le même schéma applicatif (17 tables, mêmes colonnes et 13
migrations), donc aucune migration de schéma ou de données n’est requise pour
retenir l’une d’elles. La base `elce` contient la révision 158 du document
« Accueil pour le personnel intérimaire Nutrition & Santé » contre la révision
135 dans `elce-mods`, et le document de test « Test Elcé — liens et date ».
`elce-mods` ajoute des projets temporaires de validation. La base la mieux
adaptée est donc celle de `elce` ; sa base est conservée sans migration. Ce
choix repose sur l’état des contenus, et non sur une préférence de branche.

## Validation reprise dans la copie intégrée — 2026-11-02

- Le Sommaire, les liens inline et le Graphe ont récupéré leurs règles de
  lecture dans leurs propriétaires Learning et Ressource. Les tests ciblés
  couvrant lecteur, scénario, projection, insertion de variables, application
  éditeur et Graphe passent : 112 tests. Le test de feuille de style contrôle
  aussi la grille du Sommaire, le survol sans soulignement, la marge `0.5em`
  des boutons inline et la couche HTML des libellés de Graphe.
- Dans Brave, le document « Test Elcé — liens et date » s’ouvre depuis la base
  `elce` de la copie temporaire. La date affiche la date locale. Le bouton dans
  la Section calcule bien `margin-inline: 0.5em` (environ 9,9 px de chaque
  côté à cette taille de police) ; les styles du cadre de Graphe sont actifs.
- **Lien de page dans une Section — corrigé et vérifié dans la copie intégrée :**
  la projection conservait le `span[data-elce-page-id]` éditorial sans produire
  le slot `data-part` attendu par le perso interactif ; en outre, le scénario
  n’avait pas de route pour l’événement `PAGE_LINK_PREFIX`. La contribution
  Learning projette maintenant ensemble le markup et les persos, puis le
  scénario relie l’événement à la route de la page cible en conservant ses
  gardes existantes. Le test lecteur réel Sighty/CodPlay ouvre une destination
  verrouillée par l’ordre séquentiel et « Précédent » revient à la page source.
  Brave confirme ce parcours dans « Test Elcé — liens et date », sur la copie
  intégrée isolée. Aucun changement CodPlay.
- Après la correction du lien Section, la suite complète passe avec
  `--maxWorkers=1` et l’accès loopback requis : 582 tests dans 89 fichiers. Le
  typecheck et le build passent ; le build conserve son avertissement Vite de
  chunk JavaScript supérieur à 500 kB.
- Décision utilisateur du 2 novembre : les réponses du Quiz restent en texte
  simple. Le rendu parallèle a été retiré de Learning : le libellé n’est plus
  copié dans le markup du preset et l’Input existant en fournit l’unique
  affichage. Dans le lecteur Brave de « Test Elcé — liens et date », une seule
  étiquette est visible par réponse. Les tests ciblés vérifient aussi que
  l’entrée auteur n’est pas promue en éditeur enrichi et conserve littéralement
  une chaîne qui ressemble à une date. Les réponses enrichies anciennes sont
  aplaties au rechargement du document. CodPlay n’a pas été modifié.
- Vérification de la capture fournie le 2 novembre : le lecteur avait conservé
  la classe `.elce-question-answer-row`, dont la règle auteur donne `width:
  100%` aux `input`. Le radio s’étirait alors sur la largeur du libellé et
  celui-ci passait à la ligne. La correction Learning isole la rangée lecteur
  dans `.elce-question-reader-answer-row` et aligne le radio et son libellé sur
  une même ligne. La Preview Brave réelle sur « Test Elcé — liens et date », à
  814 × 728 pixels, confirme un radio de 13 px suivi de son libellé et une seule
  occurrence de chaque réponse. L’Input existant reste l’unique source du
  libellé ; CodPlay n’a pas été modifié.
- Les titres de page et de chapitre sont maintenant envoyés au contrôleur au fil
  de la saisie non vide. Le scénario et la Preview synchronisée reflètent les
  changements sans attendre le blur ; le test navigateur a vérifié la mise à
  jour du titre de page courant, du titre d’une autre page dans le sommaire et
  du titre de chapitre. Un brouillon vide restaure la dernière valeur valide au
  blur sans renommer le modèle. Le test auteur vérifie également qu’une seule
  Annuler restaure le titre initial après plusieurs frappes. Les tests ciblés
  (31 tests sur cinq fichiers), le test SQLite ciblé et le typecheck passent.
  La validation complète de l’intégration reste ouverte pour les migrations,
  l’export et la couverture générale des champs et parcours.
- **Synchronisation de page — vérifiée dans la copie intégrée :** dans Brave,
  sélectionner une autre page dans le Scénario actualise la preview et conserve
  `aria-pressed=true`. Naviguer avec « Précédent » dans la preview coupe le
  suivi ; une nouvelle sélection dans l’éditeur ne déplace alors pas la preview.
  « Revenir sur la page éditée » affiche la page choisie et réactive le suivi.
  Ces observations suivent la [spécification de preview](../specs/player-preview-spec.md)
  et ne nécessitent pas de modification runtime.
- **Persistance du lien Section — vérifiée dans la copie intégrée :** l’édition
  du libellé depuis l’onglet « Modifier l’étiquette sélectionnée » passe à
  « Synchronisé ». L’API renvoie la révision 6 ; le GET du document contient le
  nouveau libellé dans son nœud Tiptap et son markup, et le rechargement de
  l’éditeur le restitue. Le HTTP 400 signalé auparavant ne se reproduit pas
  avec ce parcours ; sa cause initiale reste inconnue.
- **Validation du point 2 après correction :** les suites ciblées du lecteur,
  du scénario et de la projection Flux passent (92 tests sur trois fichiers),
  et la suite complète passe (582 tests sur 89 fichiers, avec un seul worker et
  loopback). `npx tsc --noEmit`, le build et `git diff --check` passent. Ces
  validations ferment les écarts de lien Section et de synchronisation
  observés ici ; la validation générale de l’intégration reste ouverte.

## Travail et acceptation

1. **Appliqué et vérifié dans la copie intégrée :** les déplacements gardent un
   seul historique, une seule persistance documentaire et une seule session/API
   dans `core/`. Les anciens points d’import `app/` et `infrastructure/`
   réexportent ces propriétaires ; Learning fournit ses codecs et services
   typés en les composant. Les spécifications de modèle, historique, session,
   cache IndexedDB et API décrivent ce partage ; la suite complète passe.
2. **Appliqué et vérifié dans la copie intégrée :** tests et spécifications
   décrivent le modèle v9, les migrations SQLite et les contrats de `elce` ; le
   contrat API distingue les écritures v9 des projets historiques v7/v8 et des
   exports compatibles. Les décisions de gabarit restent dans le plan Mods.
3. **Appliqué et vérifié dans la copie intégrée :** les deux bases comparées
   ont les mêmes 17 tables, colonnes et 13 migrations ; l’index de la fusion
   conserve exactement le fichier SQLite de `elce`, sans migration de données.
   Après les corrections, la suite complète passe (582 tests sur 89 fichiers),
   `npx tsc --noEmit` et `npm run build` passent. Le build signale toujours un
   chunk supérieur à 500 kB.
4. **Parcours de fusion appliqué et vérifié ; couverture générale de la feature
   encore ouverte :** Brave confirme la date locale en Carte, l’édition et la
   persistance d’un lien dans une Section, sa navigation et le suivi puis
   l’arrêt volontaire de synchronisation de la Preview. Les tests Learning
   couvrent la promotion au premier enrichissement des champs natifs Question
   et Carte, l’insertion et l’édition des étiquettes. Le plan Variables et liens
   reste ouvert pour ses autres champs, gestes, migrations et exports.
5. **Appliqué et vérifié dans la copie intégrée :** garder les réponses Question
   en texte simple, retirer leur rendu parallèle, isoler leur ligne des styles
   auteur et présenter le contrôle radio à gauche du libellé sur la même ligne.
   Les tests ciblés vérifient le markup de rangée lecteur et l’alignement CSS ;
   Brave confirme le rendu et un seul libellé visible dans la Preview réelle à
   814 × 728 pixels. Le correctif reste dans la ressource Question Learning ;
   aucun changement CodPlay.
6. **Appliqué et vérifié dans la copie intégrée :** synchroniser les titres de
   page et de chapitre pendant la saisie, grouper l’historique par champ,
   restaurer les brouillons vides et vérifier le scénario et la Preview.
7. **Terminé dans la copie intégrée :** fusionner après résolution des conflits,
   choix de la base, alignement des spécifications et validation complète.
