# Elcé — BDC Carousel

## Statut

**Fixe pour l’ajout en séquence dans une page Flux.** L’insertion à l’intérieur
d’un BDC Texte reste une évolution prévue et n’est pas comprise dans cette
version.

## Rôle

Le Carousel est un BDC Elcé unique placé dans la séquence ordonnée des BDC
d’une page Flux. Il transporte une suite ordonnée de vues. Le BDC n’est pas une
story CodPlay et n’est pas réutilisable ; une image ou vidéo référencée par une
vue reste une ressource média indépendante et réutilisable.

La page Flux continue d’assurer le défilement. Le Carousel occupe la largeur de
son parent et conserve le ratio défini dans ses paramètres. La valeur initiale
est 16:9. Cette tranche ne crée pas le type de page Diapo.

## Modèle Elcé

`CarouselContent` comprend le preset par défaut des nouvelles vues, la durée
par défaut, le mode de lecture, le ratio, la transition et la liste ordonnée
des vues. Chaque vue a son identifiant, un preset, un contenu conforme à ce
preset et une durée facultative en millisecondes.

Les presets de vues présents dans cette version sont :

- **Texte court**, créé par défaut, avec surtitre, titre, description, message
  limité à 250 caractères et note ;
- **Texte avec image**, avec les mêmes champs Texte court, une référence média
  et le choix gauche/droite ;
- **Photo ou vidéo plein cadre**, avec une référence média ;
- **Image avec légende**, avec une référence média et une légende.

Le preset déclare le markup HTML fixe et ses zones dans `src/config/presets.ts`.
L’auteur ne saisit pas de HTML.

Lorsqu’un auteur change le preset d’une vue, le service métier conserve les
valeurs communes aux presets source et cible. Les champs Texte court sont
conservés entre **Texte court** et **Texte avec image**. La référence média est
conservée entre **Texte avec image**, **Photo ou vidéo plein cadre** et **Image
avec légende**. Une image reste aussi attachée à la vue si l’auteur passe par
**Texte court** pour remplir ses champs ; ce preset ne l’affiche pas, mais
**Texte avec image** la réaffiche ensuite. Une vidéo n’est pas conservée dans
un preset qui ne sait pas la projeter. Modifier une autre vue sans image ne
retire pas cette référence. L’identifiant et la durée auteur de la vue sont
conservés à chaque changement. Les champs texte qui ne sont pas présents dans
le preset cible reprennent leurs valeurs initiales. Choisir à nouveau le preset
actif ne modifie pas son contenu.

Les valeurs initiales sont déclarées dans `CAROUSEL_CONFIG` : Texte court,
16:9, lecture automatique, cinq secondes par vue et fondu. En automatique,
chaque vue utilise sa durée propre lorsqu’elle est définie, sinon la durée par
défaut ; la durée totale est la somme de ces durées. En manuel comme en
automatique, les points de navigation permettent de choisir la vue. En mode
automatique, le programme temporisé continue après cette sélection. Le réglage
de transition reste commun au Carousel. En automatique, l’auteur règle le
nombre de passages supplémentaires de 0 à 10 avec « Répéter [x] fois » ; la
valeur initiale est 10. La valeur 0 correspond à une seule lecture. Cette
répétition est finie et ne s’applique pas au mode manuel.

## Circuit d’édition

L’icône « Ajouter un bloc Carousel » crée un BDC unique à la fin de la séquence
de la page et ouvre directement son éditeur central. `bdc.create` et toutes
les modifications passent par les commandes XState. `ElceCarouselService`
construit et modifie le contenu métier ; `CarouselEditor` ne conserve pas un
second état de document.

L’éditeur permet de choisir le mode, le nombre de répétitions automatiques, la
durée par défaut, le ratio, la transition et le preset des vues suivantes.
« Répéter [x] fois » apparaît en lecture automatique. L’étiquette « Durée par vue » reste
au-dessus ; le curseur et sa valeur courante sont alignés sur une même ligne.
L’auteur peut ajouter, supprimer, réordonner les vues par glisser-déposer,
choisir le preset de chaque vue, modifier ses contenus et sa durée particulière.
Pour chaque preset média, la zone de dépôt et l’aperçu du média respectent le
ratio choisi pour le Carousel ; le média est affiché en mode cover. Les vues
média peuvent référencer un média du catalogue ou recevoir un fichier ; le média
rejoint le catalogue par le circuit XState existant et les BDC Carousel le
référencent sans dupliquer la ressource. La zone vide et l’aperçu image sont un
`<label>` natif associé à un input fichier. Son attribut `accept` vient de
`MEDIA_FILE_ACCEPT` dans la configuration et combine les extensions de médias
avec les types MIME correspondants. Le choix reçu par l’input passe par la
commande d’import existante. L’aperçu vidéo reste hors du label pour garder ses
commandes de lecture distinctes ; le bouton de retrait reste indépendant.

La suppression du Carousel retire ce BDC unique de la page. Elle ne supprime
pas les ressources média qu’il référençait.

## Construction et lecture

`ElceFluxSceneBuilder` conserve l’ordre de `page.bdcIds` dans le markup de la
scène Flux et ajoute la story indépendante produite par
`ElceCarouselSceneBuilder`. Cette story donne accès aux persos de ses vues et à
son état ; elle ne devient pas un élément DOM. Le preset `carousel-basic`
déclare une zone de cadre et une zone de navigation.

`ElceCarouselSceneBuilder` emploie `AutoCapsule` pour les vues de capsule et
`CapsuleDistribution` pour leurs bornes temporelles. En lecture automatique,
les changements de vue sont des événements temporisés de la story. Le builder
répète ces occurrences dans `eventimes`, en décalant chaque passage de la durée
totale résolue par `CapsuleDistribution` ; le dernier `outro` reste omis afin
que la dernière vue demeure affichée à la fin. Le nombre de passages est fini
et le circuit ne crée ni minuteur local ni action de rejeu. Dans les deux
modes, chaque point émet un événement CodPlay ; un strap met à jour l’état de
la story et les actions de persos changent la vue visible et le point actif.
En mode automatique, les événements temporisés continuent après une sélection
par point. Les actions conservent le libellé accessible des points. Le circuit
n’ajoute ni état de lecture React ni minuteur React.

Les contenus texte et médias sont montés dans les parts du preset par des
persos CodPlay. Une ressource image ou vidéo garde son composant CodPlay
(`img` ou `media`) et est ciblée par la zone du preset. Les styles générés par
Capsule Automation sont réunis aux styles du player Elcé.

## Preuves

- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie la
  création par icône à la fin de la séquence, l’édition XState, l’ajout et le
  réordonnancement des vues, la modification d’un titre, la valeur initiale de
  répétition, la saisie du nombre, le dépôt d’une image depuis le catalogue,
  son maintien pendant la saisie sur une carte Texte court, sa réapparition en
  Texte avec image et son maintien pendant l’édition d’une autre vue sans image.
  Le même parcours vérifie le lien label/input et les filtres d’extensions par
  preset. Safari MCP confirme qu’un clic utilisateur sur le label déclenche
  un clic utilisateur non annulé sur l’input. Le panneau système de sélection
  n’est pas observable dans Safari MCP. L’auteur confirme que le sélecteur
  s’ouvre dans une fenêtre Safari non contrôlée avec les extensions explicites
  de `accept`.
- [`carousel-service.test.ts`](../src/domain/carousel-service.test.ts) vérifie
  la conservation des champs partagés et de la durée auteur lors des changements
  de carte, notamment le passage Photo → Texte court → Texte avec image.
- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie que l’image conservée n’est pas projetée par la carte Texte court,
  puis redevient un perso `img` quand la vue revient à Texte avec image ; CodPlay
  compile cette scène. Le même fichier vérifie l’ordre de la scène, les plages
  produites avec Capsule Automation, les persos texte et média et les 10
  passages automatiques supplémentaires en occurrences finies.
- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie qu’une vidéo n’est pas conservée comme référence dormante dans une
  carte Texte court.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie la sélection par point via l’événement CodPlay en modes manuel et
  automatique, le passage automatique à la vue suivante et un passage complet
  supplémentaire suivi de l’arrêt du Carousel dans le runtime player.
- Safari MCP, le 4 octobre 2026, a chargé l’application Elcé sur l’origine de
  test `127.0.0.1:5175` et vérifié la création du BDC, le réglage manuel,
  l’édition du titre et l’ajout d’une seconde vue. La preview confirme aussi
  qu’un clic sur le second point sélectionne la deuxième vue en mode automatique
  et que le champ « Répéter 10 fois » apparaît quand ce mode est choisi. Le
  contrôle temporisé reste couvert par le test du runtime ; Safari MCP avait
  l’onglet masqué, donc la vérification temporisée navigateur reste à faire.
