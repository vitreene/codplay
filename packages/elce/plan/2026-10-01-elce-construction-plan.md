# Elcé — plan de construction

**Statut : fixe — ordre accepté ; réalisation du POC en cours.**

## Cadre retenu

- Elcé est une application métier distincte dans `packages/elce`. XState
  reçoit les commandes de l’application ; React rend son état.
- Le document et les médias sont conservés localement dans IndexedDB. Le POC
  porte un seul document et ne restaure pas la progression ni les réponses de
  lecture.
- La racine Sighty contient une liste ordonnée où pages et chapitres alternent.
  Les pages d’un chapitre restent sous ce chapitre. Déplacer une page reconstruit
  le scénario ; éditer une page reconstruit sa scène.
- CodPlay et Sighty portent la lecture et la navigation, en suivant la démo 5.
  Le builder de scène et le constructeur de scénario sont distincts. La lecture
  auteur commence à la page courante.
- L’éditeur est destiné à l’ordinateur ; le player doit fonctionner sur mobile.
  L’auteur n’écrit jamais de HTML. Le JSON reste la source et le builder produit
  le markup statique.
- Un BDC n’est utilisé qu’à un emplacement. Les images et médias sont des
  ressources réutilisables du catalogue.
- Le premier parcours comprend l’organisation, le Flux, les Questions et
  l’Évaluation. La Diapo vient après cette première démonstration.

Les contrats détaillés et vérifiés sont dans les
[spécifications Elcé](../specs/). Ce plan fixe leur ordre d’application et les
preuves qui permettent de fermer chaque tranche.

## Ordre et critères de sortie

| Ordre | Tranche | État | Critère de sortie |
| --- | --- | --- | --- |
| 0 | Application et workspace | En cours | Lancement à froid, preview, typecheck, tests et build fonctionnent depuis le workspace Elcé ; le navigateur restaure le document et ses médias. |
| 1 | Modèle, commandes et organisation | En cours | Les commandes XState créent, nomment, déplacent et retirent pages/chapitres. Une page créée dans un chapitre standard reçoit un BDC Texte ; une page créée dans un chapitre d’évaluation reçoit un BDC Question. Les deux restent des pages Flux. Un chapitre d’évaluation reçoit le nom « Évaluation » sans libellé répété ; FilePlus et Trash2 font 14 px. L’icône de chapitre et son titre éditable restent sur la même ligne. L’ordre racine mixte, les pages de chapitre et les titres survivent au rechargement. Cliquer un chapitre ouvre ses réglages dans la zone centrale ; pour un chapitre Évaluation, le formulaire affiche le seuil POC fixe de 80 %, les tentatives illimitées et la reprise de toutes les questions par défaut, et permet de régler la limite d’essais ainsi que la reprise de toutes les questions ou des seules erreurs. Le catalogue « Contenus disponibles » occupe la colonne droite. Une page déplacée ne reconstruit pas les scènes. |
| 2 | Première lecture Flux dans Sighty/CodPlay | En cours | Une scène Flux réelle se lit via le scénario Sighty et son slot racine. Menu, lecture à la page courante, repère de fin, pages courtes et longues suivent les contrats de la démo 5. Un aller-retour A → B → A conserve chaque scène. |
| 3 | Éditeur Flux, médias et ancres | En cours | Tiptap exporte le HTML statique. La barre d’ajout présente les icônes de création des BDC. Le BDC Texte initial peut être supprimé par commande ; ses BDC média ancrés sont également supprimés, tandis que les ressources restent au catalogue. Dépôt depuis fichier ou catalogue passe par les commandes existantes ; un dépôt crée un BDC unique et conserve le média réutilisable. Un import identique (même type et mêmes octets, vérifiés par SHA-256) réutilise une seule ressource média, même si le nom du fichier diffère ; un fichier différent reste une ressource distincte. L’ancre reste visible à son point d’insertion, réserve l’espace du BDC sans casser le flux, et résiste à l’édition, au resize et au rechargement Safari. Les deux gestes de suppression — supprimer le BDC ou le rendre disponible — gardent leurs effets distincts. |
| 4 | Quiz simple | En cours | L’icône Quiz utilise un symbole de liste de réponses, pas un point d’interrogation. Une page créée dans un chapitre Évaluation propose une Question par défaut ; chaque page Flux n’en contient qu’une et celle-ci peut être supprimée. Vrai/Faux, Choix et Choix multiple sont éditables et validés dans le player réel. Aucune correction avant validation ; la correction apparaît après validation comme dans la démo 5. La navigation de page attend les conditions configurées, sans exiger une réponse juste par défaut. |
| 5 | Évaluation de chapitre | En cours | Les pages restent des pages Flux ordinaires : une page créée dans un chapitre Évaluation reçoit une Question par défaut, supprimable comme les autres BDC. La barre de page offre une icône pour ajouter un BDC Résultat unique, qui gère les issues Succès et Échec et rejoint Texte et Quiz. Il est relié à `EvaluationMachine` et au contexte Sighty existant. Le seuil POC reste 80 % ; les tentatives sont illimitées par défaut et la reprise porte toutes les Questions par défaut, avec l’option « erreurs seulement ». L’échec ne révèle pas les réponses. Si l’action Succès choisie est la relecture, elle ouvre toutes les Questions avec réponses données et attendues. Safari vérifie réussite 4/5, échec 3/5, reprise totale, reprise des seules erreurs et relecture après succès. |
| 6 | Acceptation de la première démonstration | En cours | Un auteur réalise le parcours complet sur ordinateur ; le player fonctionne sur mobile. Vérifier la persistance, la lecture courante, l’organisation, les ancres, les Questions, les transitions et les scénarios dans Safari. **Vérifié :** le bouton « Prévisualiser » occupe sa propre ligne au-dessus des titres et ouvre la modale (Safari, 4 octobre 2026 ; détail dans la [spécification de preview](../specs/player-preview-spec.md)). La lecture dans une fenêtre distincte est réalisée ici, ou reste dans la modale prévue si elle bloque le POC. |
| 7 | Diapo | Après la première démonstration | Construire la page Diapo autour de `capsule-automation` et des presets acceptés. Vérifier les passages manuels, l’option automatique, le retour au début et la voix lue une fois au lancement puis coupée en quittant la page. Aucun réglage d’animation ou de transition n’est ajouté au POC. |
| 8 | Acceptation finale du POC | À faire | Rejouer les parcours auteur et player, y compris mobile, chargement après fermeture, lecture intégrée et fenêtre distincte, puis typecheck, tests, build et vérifications navigateur. Documenter seulement les comportements effectivement vérifiés. |

Chaque tranche dépend des précédentes uniquement lorsqu’elle en utilise le
contrat. Un échec de preuve garde la tranche « En cours » et bloque son
intégration dépendante ; les travaux indépendants continuent.

## Décision ouverte

Pour finaliser les icônes Image et Vidéo de la barre, préciser si leur action
crée un BDC vide à compléter ou lance le choix du média. Le dépôt direct d’un
fichier ou d’une référence du catalogue dans le texte reste le parcours existant
qui crée ou attache média, BDC et ancre par les commandes.
