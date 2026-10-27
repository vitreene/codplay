# Plan Texte avec image centrée

**Statut : Fixe — comportement accepté ; code appliqué, validation restante.**

## Comportement retenu

- Ajouter « Centrée » aux positions d’image du preset Carte « Texte avec
  image », à côté de Gauche et Droite. Étendre `card.imagePosition` et son
  contrôle existant, sans créer de type BDC ni de réglage parallèle.
- Dans cette position, tous les textes sont centrés horizontalement.
- L’ordre visible est : surtitre éventuel → titre → description → image →
  message → note éventuelle. L’image se place donc entre description et message.
- Les textes occupent leur hauteur naturelle ; la zone image prend la place
  disponible entre eux et conserve les proportions de la ressource, sans
  déformation. Le même ordre s’applique aux largeurs large et mobile.
- Gauche et Droite conservent leur comportement. Position, textes, média,
  cadrage et styles restent portés par le même BDC et sont conservés lors des
  changements de présentation, conformément au
  [contrat Carte](../specs/carousel-bdc-spec.md).
- Le contrôle d’interface expose les options et délègue `setImagePosition` à
  la façade Carte existante ; il ne porte ni état métier ni règle de rendu.

## Raccord retenu

Dans `src/config/presets.ts`, placer la part image dans le groupe de contenu,
après la description et avant le message. L’ordre du DOM reste ainsi celui de
lecture pour les trois positions. En Gauche/Droite, la feuille player place
l’image en absolu dans la colonne latérale et réserve cette largeur aux textes ;
en Centrée, elle reste dans le flux flex et prend l’espace vertical disponible.
La classe de position est produite par le builder Carte partagé pour que Flux,
Diapo, Carousel et aperçu d’ancre suivent le même choix. Les parts CodPlay et
les champs enregistrés restent inchangés. Le marqueur historique
`elce-carousel-view--image-right` reste présent dans le Carousel et l’aperçu
d’ancre ; les règles de rendu utilisent la classe partagée du BDC.

## Actions ordonnées

1. **Configuration et document.** Étendre `CAROUSEL_IMAGE_POSITION` et ses
   options dans `src/config/document-config.ts` ; suivre le type dérivé et les
   invariants existants. La façade Carte et `card-service.ts` gardent le même
   circuit de mise à jour.
2. **Preset et projection.** Adapter `src/config/presets.ts` et le builder Carte
   partagé pour l’ordre des parts et la classe de position. Retirer le calcul du
   rendu propre au Carousel ; conserver son marqueur droit existant. Réutiliser
   les composants image et texte existants.
3. **Éditeur et CSS.** Alimenter le contrôle Carte existant depuis les options
   de `document-config.ts` et conserver sa délégation à la façade. Adapter
   `app/editor/anchor/elce-anchor-extension.ts`, les CSS d’aperçu et
   `player/elce-player-style.ts` : centrage horizontal des textes et zone média
   flexible qui respecte le cadrage enregistré. Aucun nouveau contrôle de taille.
4. **Vérification.** Couvrir la commande, la conservation des données, l’ordre
   des parts et les placements directs Flux/Diapo, Carousel et ancre par les
   tests propriétaires. Vérifier le player réel aux largeurs large et mobile,
   puis typecheck, tests et build depuis le paquet Elcé. Mettre à jour la
   spécification Carte seulement après vérification.

Code appliqué : option de position, ordre des parts, classe partagée, aperçus
d’ancre et styles player. La façade et le service Carte restent le circuit
d’écriture.

**Vérification Brave du 27 octobre :** le player réel en Flux montre une Carte
témoin « Texte avec image » avec image de la médiathèque existante. En Centrée,
les six zones apparaissent dans l’ordre prévu, tous les textes sont centrés,
l’image charge avec son ratio conservé, et aucun débordement horizontal
n’apparaît sur écran large et mobile. Gauche et Droite conservent leurs colonnes
latérales sur mobile ; la console n’a ni erreur ni avertissement. La Carte
témoin a ensuite été supprimée, puis la preview resynchronisée : ses textes ne
sont plus présents, l’éditeur est synchronisé et le catalogue garde ses quatre
médias. La spécification Carte décrit maintenant le comportement vérifié.

**Reste à valider :** placements directs Diapo, Carousel et ancre ; média
portrait ; conservation après rechargement, Annuler/Rétablir et changement de
layout ; export ; tests propriétaires, typecheck et build du paquet Elcé.

## Acceptation

- « Centrée » est sélectionnable dans Position de l’image ; Gauche → Centrée
  → Droite conserve tous les champs, le média et les réglages.
- Dans l’aperçu d’ancre et le player, l’image est effectivement entre
  description et message, et les textes sont centrés horizontalement.
- Une image paysage et une image portrait s’inscrivent dans l’espace disponible
  sans déformation ni débordement, après resize et changement de vue.
- Annuler/Rétablir, rechargement, navigation, Play/seek/replay et réservations
  des ancres gardent le résultat attendu. Les positions latérales restent
  fonctionnelles. L’export reproduit la même présentation par le circuit existant.

Cette variante est distincte du layout « Titre sur image » décrit dans la
[spécification Carte](../specs/carousel-bdc-spec.md).
Elle ne nécessite aucun changement du cœur CodPlay. Si un manque du circuit
est découvert, le consigner ici et arrêter le travail dépendant avant de le
contourner.
