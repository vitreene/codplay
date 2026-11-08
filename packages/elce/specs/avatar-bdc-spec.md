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

Chaque entrée Carousel conserve une durée ; le début de la vue est le cumul
des durées précédentes. La référence facultative `cue.word` identifie l’Avatar,
la prise et l’index d’occurrence, sans stocker un temps absolu dans le Carousel.
L’index distingue les répétitions d’un même mot. La première vue commence
implicitement à zéro et ne reçoit pas d’association ; sa durée reste une durée
ordinaire de vue.

Quand une prise est disponible, chaque autre carte expose son propre groupe de
boutons radio cachés. La valeur du bouton radio est le début du mot en
millisecondes ; son libellé visible est seulement le mot. Le choix associe le
mot puis recalcule et enregistre les `durationMs` concernés. Les débuts de mots
servent à calculer les intervalles entre vues ; la lecture consomme les durées
cumulées et aucun repère absolu n’est persisté. Le contrôle affiche « Mot
associé » avec le mot seul, ou « Durée (sec.) » avec une durée éditable lorsqu’il
n’y a pas d’association. `durationMs: null` hérite de la durée commune du
Carousel, fixée à cinq secondes par défaut. Aucun sélecteur global de transcript
n’est placé dans l’éditeur Carousel.

Un choix peut dépasser les associations déjà présentes sur les vues suivantes.
L’auteur peut choisir toute occurrence postérieure aux associations des vues
précédentes ; si elle dépasse des associations suivantes, ces liens dépassés
sont supprimés, puis les durées sont recalculées. Les vues libres entre deux
associations actives partagent l’intervalle. Après la dernière association, les
vues libres gardent leurs durées enregistrées (ou héritent de la durée commune)
et la dernière vue se termine à la fin de la prise. Si les durées des vues
libres avant la dernière ne tiennent plus dans le temps restant, elles sont
réparties également pour laisser une durée positive à chacune. L’auteur n’a pas
à nettoyer les durées à la main. Le champ de la carte associée affiche le mot ;
il ne présente pas le temps du mot sous le libellé « Durée » ou « Repère ».
Pour chaque autre carte, la liste des occurrences est visible par défaut dans
une zone compacte, bordée et pleine largeur, séparée du réglage de durée. Une
flèche de bascule placée en haut à droite du cadre la replie et la rouvre ; le
repli masque effectivement les mots. Les choix montrent uniquement les mots ;
leurs temps restent portés par les radios et l’association sauvegardée.

Retirer l’Avatar ou remplacer sa prise supprime les associations aux mots et
conserve les durées des cartes. Lorsqu’un ancien document stocke encore des
débuts absolus, la migration les convertit en intervalles `durationMs` avant de
retirer ces débuts. L’auteur peut ensuite associer les cartes au nouveau
transcript ; ces choix recalculent les durées concernées à partir des nouvelles
occurrences.

Lors d’un réordonnancement, une carte déplacée en première position revient à
zéro sans association ; l’ancienne première carte devient associable. Les
autres liens restent attachés à leur carte. Si un mot associé ne respecte plus
l’ordre des cartes, le lien reste mémorisé mais son radio est visible et
désactivé. Cette vue est traitée comme libre : les durées entre associations
actives partagent l’intervalle ; les durées après la dernière association
restent inchangées sauf ajustement nécessaire pour finir avec la prise. Quand
l’ordre rend à nouveau le mot compatible, il redevient actif et ses durées sont
recalculées. Cette règle de réordonnancement n’empêche pas un nouveau choix :
celui-ci annule les associations ultérieures qu’il dépasse.

## Éditeur de l’Avatar

L’éditeur reprend les composants visuels partagés des BDC. Il fournit les
réglages de coin et le slider de largeur, une action de suppression par icône,
le lecteur audio de la prise et son transcript. Le BDC n’affiche que son titre
« Avatar » ; aucun sous-titre « Prise sonore » ne précède la zone audio. Le
bouton coloré « Capture live », plus grand que les icônes d’action, est placé à
droite du lecteur sur la même ligne. Le transcript vient avant son bilan de
mots et de durée, avec un espacement court. « Capture live » ouvre une modale
dédiée. Elle présente « Micro » et « Caméra » avec une action de démarrage dans
chaque panneau, sans réglage de suivi facial visible. Elle peut aussi générer
une voix ou charger un audio ; l’import fichier par fichier dans le BDC n’est
pas proposé.
La modale garde les mêmes dimensions en passant entre « Réglages », « Capture »
et les onglets de source. Sa largeur et sa hauteur sont limitées par la fenêtre ;
son contenu défile à l’intérieur.

## Preuves

- [`avatar-authoring.test.ts`](../src/mods/learning/integration/avatar-authoring.test.ts)
  vérifie la cardinalité, la conversion d’un document v11 en durées v12, la
  conservation des durées au retrait/remplacement et la réassociation à une
  nouvelle prise. Il vérifie aussi qu’un réordonnancement rend un lien hors
  ordre inactif pour le calcul des durées, puis le réactive au retour.
- [`learning-page-editor.test.tsx`](../src/mods/learning/authoring/learning-page-editor.test.tsx)
  vérifie les contrôles d’édition, l’absence d’import fichier et de case
  `autoStart`, le transcript et la modale Capture live. Il vérifie aussi qu’après
  remplacement de la prise, les cartes non premières peuvent chacune être
  associées par clic à une occurrence compatible du nouveau transcript et que
  leurs durées sont recalculées.
- [`avatar-authoring.test.ts`](../src/mods/learning/integration/avatar-authoring.test.ts)
  vérifie qu’un nouveau mot qui dépasse une association enregistrée l’annule
  et que les durées des vues sont recalculées automatiquement.
- [`diapo-scene-builder.test.ts`](../src/mods/learning/integration/diapo-scene-builder.test.ts)
  vérifie l’overlay et la projection du placement avec ses propres fixtures.
- Safari MCP vérifie dans la preview du Projet 3 le BDC configuré en haut à
  droite à 1280 × 756 et 390 × 844, avec le Carousel plein cadre et l’Avatar
  affiché après Play. Les mesures et les bords visibles du canvas sont dans le
  [relevé d’acceptation](../notes/assets/talking-head/elce-project-3-acceptance.json).
- Safari MCP vérifie dans l’éditeur du Projet 3 que les 41 mots de la deuxième
  carte apparaissent dans la zone pleine largeur bordée, avec la flèche de bascule en haut à
  droite. Le cadre est ouvert par défaut ; le clic replie réellement la liste,
  masque les mots et inverse la flèche, puis rouvre la liste. Le build Elcé
  passe.
- Le 8 novembre, Safari MCP vérifie dans le Projet 3 le choix réel d’un mot
  sur la troisième carte (`humaine.` à 9 044 ms), puis d’un mot plus tardif sur
  la deuxième (`La` à 10 031 ms). Le second choix est accepté, retire
  l’association dépassée de la troisième carte, recalcule sa durée à 1,193 s
  et laisse les mots postérieurs sélectionnables. Les deux écritures API
  répondent 200. Deux annulations restaurent les associations et durées
  initiales ; après rechargement, le Projet 3 est synchronisé et la première
  carte affiche sa durée de 0,743 s.
- Le 5 novembre, Safari MCP a vérifié visuellement l’éditeur du Projet 3 en
  lecture seule : « Avatar » reste le seul titre du BDC ; le lecteur audio et
  « Capture live » partagent une ligne, le bouton étant à droite et coloré ;
  le transcript précède le bilan statistique avec 6 px entre les deux blocs.
  L’affichage n’a modifié aucune donnée du projet.
- Le 6 novembre, Safari MCP confirme que la modale garde 608 × 672 px sur
  « Réglages » et « Capture » à grande largeur, puis 411 × 672 px sur les deux
  onglets principaux et les trois sources audio à largeur réduite. Aucun appel
  API ni changement du document projet n’a été effectué.
- Le 6 novembre, Safari MCP confirme que la modale expose les sources Micro et
  Caméra et que le panneau Caméra affiche son action sans réglage facial. Aucun
  appareil n’a été démarré pendant ce contrôle visuel ; le flux de captation reste à accepter dans le
  [plan talking-head](../plan/2026-11-04-talking-head-plan.md).

La suite complète de persistance, Undo/Redo, réassociation et affichage initial
du rig reste à vérifier dans le
[plan talking head](../plan/2026-11-04-talking-head-plan.md#lot-4--intégration-auteur--implémentation-en-cours).
