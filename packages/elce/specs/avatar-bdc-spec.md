# Elcé — BDC Avatar narré

## Périmètre vérifié

Le BDC Avatar est un bloc direct d’une Diapo et reste frère du Carousel. Une
Diapo accepte au plus un Avatar et au plus un BDC de contenu. Cette version
compose l’Avatar avec un Carousel ; elle ne place pas l’Avatar dans une vue
enfant, ne l’ajoute pas à une page Flux et ne crée pas un circuit de lecture
distinct.

Les règles de composition et de grille sont dans la
[spécification du builder Diapo](./diapo-scene-builder-spec.md). La
télécommande partagée et le mode de démarrage sont dans la
[spécification preview](./player-preview-spec.md#télécommande-de-la-diapo-narrée-de-démonstration).

## Données de la prise

`AvatarContent` conserve le profil, le placement et une prise optionnelle.
Une prise identifie son audio (`audioMediaId`), sa durée en millisecondes, ses
occurrences de transcript (`text`, `startAtMs`, `endAtMs`) et ses frames de
visèmes. Le transcript n’est conservé qu’avec la prise ; le Carousel ne le
copie pas.

Le réglage `placement` choisit un coin haut/bas et gauche/droite, puis une
largeur en pourcentage. Le slider auteur propose cinq valeurs : 10, 20, 30, 45
et 60 %. Le bord peint du rig reste à 16 px du coin choisi, quelle que soit la
taille de l’Avatar. Le builder compense le vide transparent mesuré dans le rig
fourni : 29,76 % à gauche, 25,8 % en haut, 27,14 % à droite et 23,2 % en bas.
Le profil du rig fourni est conservé et son fond reste transparent ;
l’apparence du BDC peut régler un fond.

Pour compatibilité avec les documents existants, `autoStart` peut rester dans
les données persistées. La lecture n’en dépend pas : le mode Automatique ou
Manuel du Carousel détermine le démarrage de la Diapo.

## Association aux cartes du Carousel

Chaque entrée Carousel conserve son temps `cue.startAtMs`, qu’elle soit liée ou
non à une occurrence de mot. Une association facultative identifie l’Avatar, la
prise et l’index de l’occurrence. L’index distingue les répétitions d’un même
mot. La première carte commence à zéro et ne reçoit pas d’association.

Quand une prise est disponible, chaque autre carte expose son propre groupe de
boutons radio cachés. La valeur du bouton radio est le début du mot en
millisecondes ; son libellé visible est seulement le mot. Le choix met à jour
ensemble l’association et le temps de la carte. Le champ de durée affiche alors
le mot choisi. En l’absence d’association, il affiche le temps conservé. Pour
la première carte, le repère zéro reste implicite et le champ est vide : `0 s`
serait compris comme une durée nulle, alors que l’absence de valeur indique une
durée illimitée. Aucun sélecteur global de transcript n’est placé dans
l’éditeur Carousel.
Pour chaque autre carte, la liste des occurrences est visible par défaut dans
une zone compacte, bordée et pleine largeur, séparée du réglage de durée. Une
flèche de bascule placée en haut à droite du cadre la replie et la rouvre ; le
repli masque effectivement les mots. Les choix montrent uniquement les mots ;
leurs temps restent portés par les radios et l’association sauvegardée.

Retirer l’Avatar ou remplacer sa prise supprime les associations aux mots et
garde exactement les temps des cartes. L’auteur peut associer chaque carte au
nouveau transcript, ce qui remplace son temps par le début de la nouvelle
occurrence choisie.

Lors d’un réordonnancement, une carte déplacée en première position revient à
zéro sans association ; l’ancienne première carte devient associable. Les
autres liens restent attachés à leur carte. Si un mot associé ne respecte plus
l’ordre des cartes, le lien reste mémorisé mais son radio est visible et
désactivé. Son repère effectif devient libre : les cartes libres entre deux
liens actifs se partagent également l’intervalle ; après le dernier lien
actif, elles avancent selon la durée de l’entrée précédente ou la durée par
défaut du Carousel. Quand l’ordre rend à nouveau le mot compatible, le repère
revient à son temps transcript et le radio redevient sélectionnable.

## Éditeur de l’Avatar

L’éditeur reprend les composants visuels partagés des BDC. Il fournit les
réglages de coin et le slider de largeur, une action de suppression par icône,
le lecteur audio de la prise et son transcript. Le BDC n’affiche que son titre
« Avatar » ; aucun sous-titre « Prise sonore » ne précède la zone audio. Le
bouton coloré « Capture live », plus grand que les icônes d’action, est placé à
droite du lecteur sur la même ligne. Le transcript vient avant son bilan de
mots et de durée, avec un espacement court. « Capture live » ouvre une modale
dédiée ; elle indique que la captation réelle n’est pas encore disponible.
L’import fichier par fichier n’est pas proposé.
La modale garde les mêmes dimensions en passant entre « Réglages », « Capture »
et les onglets de source. Sa largeur et sa hauteur sont limitées par la fenêtre ;
son contenu défile à l’intérieur.

## Preuves

- Le service de commandes Learning, exécuté en mémoire avec le document Projet
  3 lu en lecture seule depuis IndexedDB, vérifie les déplacements des 3e et 4e
  cartes en première position, le déplacement d’une carte au-delà d’un repère
  suivant et son retour à l’ordre initial. Les repères restent croissants, les
  liens non premiers restent attachés à leur carte et le lien hors ordre est
  réactivé quand il redevient compatible. L’[acceptation du lot 4](../plan/2026-11-04-talking-head-plan.md#lot-4--intégration-auteur--implémentation-en-cours)
  suit encore le drag UI et la sauvegarde/réouverture.
- [`avatar-authoring.test.ts`](../src/mods/learning/integration/avatar-authoring.test.ts)
  vérifie la cardinalité, les associations, les temps conservés lors d’un
  retrait/remplacement et la réassociation à une nouvelle prise.
- Le 5 novembre, Safari MCP a vérifié le bouton « Supprimer l’Avatar » sur une
  copie temporaire du Projet 3 : le mot associé à la carte 2 disparaît et son
  repère reste à 5 770 ms ; le mode Manuel, la transition et le ratio du
  Carousel restent inchangés. Après fermeture et réouverture de la copie, le
  temps est toujours présent. La copie a été supprimée ; le Projet 3 original
  est resté intact.
- [`learning-page-editor.test.tsx`](../src/mods/learning/authoring/learning-page-editor.test.tsx)
  vérifie les contrôles d’édition, l’absence d’import fichier et de case
  `autoStart`, le transcript et la modale Capture live.
- [`diapo-scene-builder.test.ts`](../src/mods/learning/integration/diapo-scene-builder.test.ts)
  vérifie l’overlay et la projection du placement avec ses propres fixtures.
- Safari MCP vérifie dans la preview du Projet 3 le BDC configuré en haut à
  droite à 1280 × 756 et 390 × 844, avec le Carousel plein cadre et l’Avatar
  affiché après Play. Les mesures et les bords visibles du canvas sont dans le
  [relevé d’acceptation](../notes/assets/talking-head/elce-project-3-acceptance.json).
- Safari MCP vérifie dans l’éditeur du Projet 3 que le champ de la première
  carte est vide à zéro, et que les 41 mots de la deuxième carte apparaissent
  dans la zone pleine largeur bordée, avec la flèche de bascule en haut à
  droite. Le cadre est ouvert par défaut ; le clic replie réellement la liste,
  masque les mots et inverse la flèche, puis rouvre la liste. Le build Elcé
  passe.
- Le 5 novembre, Safari MCP a vérifié visuellement l’éditeur du Projet 3 en
  lecture seule : « Avatar » reste le seul titre du BDC ; le lecteur audio et
  « Capture live » partagent une ligne, le bouton étant à droite et coloré ;
  le transcript précède le bilan statistique avec 6 px entre les deux blocs.
  L’affichage n’a modifié aucune donnée du projet.
- Le 6 novembre, Safari MCP confirme que la modale garde 608 × 672 px sur
  « Réglages » et « Capture » à grande largeur, puis 411 × 672 px sur les deux
  onglets principaux et les trois sources audio à largeur réduite. Aucun appel
  API ni changement du document projet n’a été effectué.

La suite complète de persistance, Undo/Redo, réassociation et affichage initial
du rig reste à vérifier dans le
[plan talking head](../plan/2026-11-04-talking-head-plan.md#lot-4--intégration-auteur--implémentation-en-cours).
