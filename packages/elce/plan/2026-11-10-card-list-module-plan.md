# Plan — BDC Liste dans les champs de texte riches

**Statut : En cours.** La Liste s’insère dans le champ « Message » des layouts
Card Texte court et Texte avec image, et dans le contenu Tiptap d’une Section.
La barre de Section expose la commande « Liste à points » ; ses commandes de
titre s’arrêtent à H3, tout en conservant la lecture des titres H4 à H6.
Dans les deux champs riches, le nœud Liste héberge son éditeur au point
d’insertion. Dans la barre Section, son bouton est placé près de « Points de
suite ».

## Objectif et décisions acquises

- « Liste à points » est un BDC enfant autonome, référencé par un nœud Tiptap
  de niveau bloc dans le Message d’une Carte ou le contenu d’une Section. Ce
  n’est plus un layout de Carte destiné aux nouvelles créations.
- L’insertion après le bloc courant, la création du BDC et la mise à jour du
  champ riche parent forment une commande Learning atomique. L’éditeur Liste
  existant conserve l’édition de son payload et s’affiche dans le NodeView de
  référence, dans le flux du texte, sans seconde copie sous le champ.
- La projection lecteur compose `ListSceneBuilder` entre les blocs de texte et
  transmet à la Liste le cycle d’entrée/sortie de sa Carte hôte. Chaque ligne
  utilise son délai propre ou l’intervalle commun, y compris la première ligne
  depuis l’entrée de la Carte ; les offsets cumulés suivent le temps de lecture,
  avec `eventimes` compilés pour les entrées calendaires et des straps CodPlay
  pour les entrées live. Seek, sortie et réentrée doivent reconstruire l’état
  depuis ce calendrier. Aucun changement de CodPlay core n’est prévu.
- Le layout Card `list-basic` historique reste lisible. Il n’est pas la voie
  d’insertion de la nouvelle Liste et ne doit pas exposer les contrôles du BDC
  Liste dans son ancien éditeur.
- Les autres champs Tiptap, hors Message de Carte et contenu de Section, et les
  autres BDC ne sont pas dans cette portée.
- **Décision d’interface acceptée — mode de la Liste :** dans Card et Section,
  le NodeView affiche d’abord le rendu réel de la Liste. Son bouton Settings2
  ouvre l’éditeur partagé au même emplacement ; le bouton de l’éditeur revient
  au mode vue. Un contour tireté gris clair `#9da9a5` de `2px` identifie le
  BDC dans les deux modes. Cet état reste local à l’éditeur et ne modifie pas
  le document. En mode vue, réduire de `0.5rem` l’espace après le bouton
  d’édition et séparer les items successifs par `0.5rem`. Le bouton de mode
  garde la même taille et se centre symétriquement avec la poignée de
  déplacement dans les angles supérieurs, comme sur le cadre image, en mode vue
  comme en mode édition. Son placement est relatif au cadre et indépendant du
  padding du contenu ; l’en-tête réserve sa place dans le flux pour éviter le
  chevauchement avec la Liste.
- **Décision d’interface acceptée — éditeur Liste compact :** les paramètres
  restent sur une ligne flex sans retour, avec défilement horizontal si leur
  contenu dépasse, libellés courts et harmonisés à la taille de réglage Elcé,
  et `1rem` de padding intérieur du cadre. Départ garde une base flex ajustée
  pour afficher trois chiffres. Le select Préfixe affiche directement
  chaque marqueur, sans le mot « Exemple » ; « Aucun » désigne l’absence de
  marqueur et le marqueur personnalisé est suivi de « Personnalisé ». Le délai
  commun est toujours affiché ; seuls les délais propres aux items sont repliés
  derrière Clock. Une valeur distincte de l’héritage ou du défaut teinte l’icône
  Clock de l’item comme les boutons actifs Elcé. L’éditeur masque le délai de
  l’item dès son blur ou la validation par Entrée, et le titre de Clock conserve
  la durée formatée. Le glisser-déposer marque le slot avant ou
  après la ligne visée, avec des cibles visibles avant la première et après la
  dernière ligne. L’ajout de ligne reprend le bouton carré d’icône partagé des
  poignées.
- **Décision de déplacement acceptée — Liste inline :** le BDC Liste reçoit la
  poignée circulaire `↕` déjà utilisée par une Carte ancrée. Elle déplace le
  nœud Tiptap bloc dans le même champ de texte, sans le sortir du flux ni créer
  une copie. Si le dépôt tombe dans un paragraphe, le nœud est inséré après ce
  paragraphe pour ne pas couper un mot.
- **Décision lecteur acceptée — apparence Liste inline :** une Liste est
  projetée dans le flux texte de sa Carte ou Section et hérite visuellement de
  son hôte. Elle ne constitue pas une surface d’apparence BDC indépendante.
- **Décision de temporisation acceptée :** pour chaque ligne, `delayMs` remplace
  l’intervalle commun lorsqu’il est défini ; sinon `intervalMs` s’applique,
  également à la première ligne après l’entrée de la Carte.
- **Décision de transition acceptée :** la transition d’apparition des lignes
  appartient au BDC Liste et s’applique à chaque ligne quand son délai expire,
  dans une Carte comme dans une Section. Le réglage réutilise les options de
  transition de révélation existantes ; son défaut reste le fondu actuel.

## Circuit et invariants

- Réutiliser `ResourceTextFieldFeature` dans le champ Message, l’injection
  `SectionTextFeature` dans l’éditeur Section, le service de commandes
  Learning/XState, `ListService`, `ListEditor` et
  `ResourceInlineTextSceneFeature`.
- Persister le payload de chaque BDC Liste dans la table de détails `list_bdcs`,
  liée à `content_blocks` comme les détails Avatar ; le champ historique
  `cards.list_json` reste réservé aux anciens layouts Carte.
- Chaque BDC Liste appartient à une Carte ou une Section, a `pageId: null`, et
  est référencé exactement une fois dans le champ compatible de son parent.
  Une référence orpheline, dupliquée ou placée dans un autre parent est invalide.
- Retirer la référence supprime le BDC enfant ; supprimer la Carte ou la Section
  supprime ses listes enfants. Undo/Redo doit préserver les identités et valeurs.
- La migration de document conserve les anciennes données Card `list-basic`.
  Ne pas convertir ni supprimer ces données sans une stratégie non destructive
  définie.

## Actions et critères d’acceptation

1. [x] Ajouter le type/payload BDC Liste, son nœud Tiptap, la commande atomique,
   l’éditeur réutilisé, les invariants et la migration documentaire.
2. [x] Raccorder l’insertion et l’édition à « Message » des layouts Texte court
   et Texte avec image, puis au contenu Tiptap de Section via son injection ;
   ajouter sa commande à la barre de Section et retirer H4 à H6 de cette barre
   sans retirer leur prise en charge du schéma ; retirer la création autonome
   de Carte Liste.
3. [x] Monter `ListEditor` dans le NodeView du bloc Liste pour les champs
   Message et Section, supprimer les éditeurs répétés après le champ, et placer
   le bouton Liste Section auprès de « Points de suite ».
4. [x] Projeter les listes dans le flux de texte Card et transmettre les
   paramètres d’animation depuis les lecteurs Learning et Carousel.
5. [x] Rattraper le payload d’une Liste antérieure à `list_bdcs` depuis
   `cards.list_json` sans modifier la source, puis vérifier par
   `GET /api/projects/:projectId` que la Liste est relue avec son contenu.
6. [ ] Vérifier l’aller-retour SQLite automatisé, l’insertion après paragraphe,
   le texte voisin, Undo/Redo et la
   suppression du parent, dans Card et Section.
7. [ ] Vérifier l’ordre lecteur et les animations lors de Play, Seek, sortie,
   réentrée et replay dans les parcours réels Learning, Carousel et Section.
8. [ ] Exécuter les tests d’intégration pertinents et le build depuis
   `packages/elce` ; le typecheck et l’inspection navigateur du NodeView restent
   déjà vérifiés pour cette tranche.
9. [x] Ajouter la bascule vue/édition de la Liste dans le NodeView partagé,
   projeter les mêmes marqueurs que le lecteur et réutiliser le bouton de mode
   circulaire existant, puis vérifier les deux modes dans Card et Section.
   Brave MCP confirme le contour tireté et la bascule sans changement de document ; les
   vérifications complètes de l’aller-retour restent à l’action 6. Contrats
   consignés dans les spécifications Document et Section.
10. [ ] Terminer l’éditeur Liste partagé dans Card et Section : garder les
    paramètres sur une seule ligne flex, afficher directement les marqueurs
    sans le mot « Exemple », garder le délai commun visible et laisser repliés
    les seuls délais d’item, marquer le slot de dépôt avant ou après la ligne
    visée (y compris les extrémités), et masquer le délai d’item dès le blur ou
    Entrée en conservant sa valeur dans le titre de Clock. Dimensionner Départ à
    trois chiffres par flex-basis. Réutiliser les tailles
    d’icônes et de boutons existantes. La vérification MCP de Section couvre
    les libellés, les deux extrémités du dépôt, le blur vers Clock et l’icône
    personnalisée ; vérifier encore le parcours Card.
11. [x] Exclure les BDC Liste inline du calcul des surfaces d’apparence. Brave
   vérifie que la preview de « Présentation du module » affiche le contenu
   complet et la Liste dans le flux, sans erreur console ni fallback de rôle.
   Le contrat d’héritage figure dans la spécification Apparence.
12. [ ] Appliquer l’intervalle commun avant la première ligne sauf délai propre,
    puis vérifier la chronologie à l’entrée de Carte.
13. [ ] Dans `resources/list/domain/` et `authoring/list-editor.tsx`, ajouter
    au payload du BDC Liste un choix de transition, réutilisant
    `CAROUSEL_TRANSITION_OPTIONS` avec Fondu par défaut ; dans
    `reading/list-scene-builder.ts`, animer chaque ligne au moment de son
    événement de révélation avec les actions partagées de
    `resources/revelation/revelation-action.ts`. Garder délai et transition
    indépendants de la Carte hôte. Rétablir les états initiaux à la sortie et
    lors du replay, et traiter « Aucune » comme une apparition instantanée.
    Rétro-remplir en SQLite les payloads Liste existants avec Fondu. Pour les
    Sections, monter observateur, items et strap dans la story de page Flux ;
    observer la racine Liste dans le scrollport par `emit.observe` et transmettre
    entrée/sortie au strap List existant.
    Accepter chaque option, les délais du
    premier item et des suivants, sortie/replay, Card et Section, et relecture
    SQLite. Le contrôle Transition, le défaut Fondu et la migration sont
    vérifiés ; la preview Section rend la Liste sans erreur de scène ni console.
    Le parcours des transitions et du replay reste à vérifier.
14. [ ] Appliquer l’espacement du mode vue dans `resources/list/authoring/list-editor.css` :
    réduire de `0.5rem` l’espace entre le bouton d’édition et la Liste, puis
    séparer les items successifs de `0.5rem`. Vérifier le mode vue de Section
    et Carte dans Brave MCP, sans modifier le contenu. Section est vérifiée ;
    la Carte reste à contrôler.
15. [x] Harmoniser les deux commandes de coin dans
    `resources/list/authoring/list-editor.css` avec le cadre image : garder les
    boutons et icônes partagés, aligner les cercles sur les mêmes retraits de
    cadre dans les modes vue et édition, et compenser la bordure du cadre Liste
    dans les coordonnées absolues. Garder le padding du contenu indépendant et
    réserver l’espace du bouton mode dans l’en-tête. Brave vérifie les deux
    modes de Liste et l’image : les cercles partagent le diamètre `22.4px`, le
    retrait du bord supérieur vaut `8px` et leurs retraits aux bords horizontaux
    sont égaux. Le navigateur est revenu au mode vue et à l’onglet Presse-papiers.
16. [x] Dans `list-bdc-extension.ts`, `list-editor.tsx` et les styles auteur
    partagés, ajouter la poignée circulaire `↕` en haut à gauche, le déplacement
    natif du seul nœud Liste et son insertion après le paragraphe ciblé.
    L’identité BDC reste celle du nœud déplacé.
17. [ ] Valider le glisser-déposer natif dans les champs Message et Section,
    la persistance, l’intégrité des mots voisins et l’absence de copie du BDC.
    La Section passe dans Brave : la Liste est déposée sur un paragraphe, se
    replace après celui-ci, reste unique et se restaure à sa place après
    synchronisation et rechargement. Le champ Message de Carte reste à valider.
18. [x] Séparer le BDC Liste du contenu suivant avec la même marge basse que les
    paragraphes de Section (`0.35rem`), sur le conteneur de flux du NodeView.
    Brave confirme `5.6px` pour la marge du NodeView et des paragraphes de
    Section ; onglet visible et au premier plan, sans modification du contenu.

La tranche reste `En cours` jusqu’à preuve des critères 6 à 8. Une validation
de type seule ne certifie pas le comportement d’intégration.
