# Elcé — variables et liens internes

**Statut : En cours — insertion, rendu, lien interne et sortie anticipée sont
implémentés et validés sur le parcours retenu ; les autres champs, gestes et
formats d’acceptation restent à couvrir. L’édition d’une étiquette sélectionnée
est raccordée et testée dans l’éditeur ; l’enregistrement serveur reste à
valider, car l’API de test a répondu HTTP 400.**

## État d’implémentation — 2026-11-02

- Le modèle Elcé v9, les migrations des textes v7 et du réglage de page v8, le
  stockage des valeurs Tiptap dans les colonnes textuelles existantes et les
  commandes des champs Carte, Question, Graphe, Résultat, Section, Sommaire,
  chapitre et page sont raccordés.
- Le catalogue partagé propose les propriétés de profil, les pages de scénario,
  la date du jour, l’heure locale et une date relative paramétrée en jours.
- Les champs simples restent natifs jusqu’à une insertion d’étiquette ; Message
  Carte peut aussi être promu par les commandes Gras et Italique. Sa limite de
  caractères compte les atomes comme prévu.
- Les builders Carte, Question, Résultat, Section, Sommaire et Graphe projettent
  les valeurs résolues en contenu sûr et les liens de page en événements Elcé.
  Les labels du Graphe utilisent les ancres HTML existantes ; les libellés SVG
  interactifs sont superposés en HTML dans le builder Elcé, sans changement du
  cœur CodPlay.
- Le réglage « Ignorer la contrainte de lecture » est disponible dans l’onglet
  Style du panneau droit de la page ciblée, avec ou sans lien. La valeur
  automatique s’active quand la page contient un lien interne ; le choix
  explicite de l’auteur remplace ce défaut. Un lien peut ouvrir une destination
  verrouillée uniquement par l’ordre séquentiel, sans inscrire sa lecture ni
  contourner les gardes de profil, de chapitre ou d’évaluation.
- Les valeurs de profil projetées vers les champs texte restent du texte brut ;
  les builders échappent les valeurs uniquement quand ils construisent du HTML.
  Le token historique de profil dans le HTML sérialisé d’une Section conserve
  son échappement dédié.
- Le parcours Brave du 2 novembre sur la copie locale migrée v8 → v9 valide la
  Section, le Message de Carte, le rendu des étiquettes et l’aller-retour par
  lien avant la fin fonctionnelle de la page source. L’acceptation globale reste
  partielle : les autres champs, gestes d’édition, cas de migration et export
  restent à couvrir.

## Objectif

Rendre disponibles dans les textes Elcé des références vers les propriétés de
profil, les dates et les pages internes. L’auteur doit pouvoir les insérer
depuis le panneau « Contenus ». L’éditeur présente les étiquettes ; la preview
présente leur résultat. Les variables d’identité apprenant sont hors périmètre
tant qu’aucun circuit Elcé ne les fournit.

Le périmètre couvre les textes métier présentés au lecteur : Sommaire, titres
de chapitre et de page, Sections, Cartes, Questions, Graphes et Résultats
d’Évaluation. Les libellés de configuration et les textes de l’interface de
l’éditeur restent hors cible. Un champ simple reste un `input` ou `textarea`
jusqu’à l’insertion d’une étiquette ou l’application d’un enrichissement permis
par ce champ ; il est alors promu en éditeur Tiptap.

## Contrats existants à préserver

- Les références de profil dans un champ simple utilisent
  `{{profile:<id>}}`. Dans Section, la référence est un nœud inline Tiptap
  `profileLabel` avec `profilePropertyId`, sérialisé en
  `span[data-elce-profile-property]`.
- Le panneau « Contenus » insère une référence dans le champ textuel compatible
  actif. Dans un champ simple, il insère le texte de référence à la sélection
  avec `setRangeText` ; dans Section, il envoie une intention à l’adaptateur
  Tiptap, qui insère un nœud au caret. Le contrôle partagé est un bouton ; le
  glisser-déposer n’est pas encore dans ce circuit.
- `projectReaderDocument()` construit une projection immuable pour le lecteur.
  La projection profil résout déjà les chaînes simples et le marqueur HTML de
  Section sans remplacer le document auteur.
- Les écritures Section passent par le modèle JSON, les commandes Elcé et
  l’historique documentaire ; aucune insertion ne doit contourner ce circuit.

### Champs texte ordinaires déjà raccordés

Les champs simples ne sont pas seulement une possibilité théorique : le circuit
de profil existant les prend déjà en charge. Dans les Cartes, les contrôles de
surtitre, titre, description, message, note et légende sont déclarés comme
cibles d’insertion lorsqu’ils sont affichés par le layout. Le panneau insère le
token dans leur `input` ou `textarea` ; les commandes Carte enregistrent la
chaîne. La projection résout ensuite les champs de texte de la Carte, et le
builder projette chaque champ visible en contenu texte dans sa zone CodPlay.
Les mêmes champs restent conservés quand un autre layout les masque.

Le même circuit de champs simples est déclaré pour le titre, la question, le
libellé de validation et les réponses d’une Question, les textes et libellés de
tableau d’un Graphe, ainsi que les messages de résultat d’Évaluation. Section
est le seul éditeur riche déclaré parmi ces cibles. Le marqueur de cible
`data-elce-profile-token-target` ne couvre actuellement qu’une partie des
propriétés textuelles ; l’inventaire défini plus haut étend le catalogue à tous
les textes métier.

Dans les champs simples, l’auteur voit aujourd’hui la syntaxe brute du token ;
seule la Section montre une étiquette Tiptap. La demande s’applique aussi aux
Cartes et autres champs ordinaires : l’étiquette doit y rester visuellement
identifiable dans l’éditeur. Un `input` ou `textarea` seul ne peut pas afficher
un nœud visuel au milieu de son texte ; il faut donc adapter la surface
d’édition pour gérer ensemble texte, étiquettes et sélection, tout en conservant
les commandes métier actuelles.

Références : [spécification Sommaire et profils](../specs/summary-profile-spec.md),
[plan Sommaire et profils](./2026-10-14-elce-sommaire-profils-plan.md),
[spécification Section](../specs/section-editor-spec.md) et
[spécification preview](../specs/player-preview-spec.md).

## Résultat de l’étude préalable

Les éditeurs consultés représentent ces valeurs comme des données structurées
du document. Tiptap transforme éventuellement un motif saisi en nœud par une
Input Rule ; ses Node Views peuvent montrer une étiquette dans l’éditeur tout en
gardant une sérialisation distincte. CKEditor Merge Fields fournit un exemple
direct de champs de fusion : l’auteur voit les étiquettes, une preview peut
montrer un jeu de valeurs, et les données sauvegardées conservent les références.
Voir les documentations officielles Tiptap sur les
[Input Rules](https://tiptap.dev/docs/editor/api/input-rules) et les
[Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views),
et CKEditor sur les [Merge Fields](https://ckeditor.com/docs/ckeditor5/latest/features/merge-fields.html).

**Circuit retenu :** la projection lecteur existante reste le lieu commun de
résolution. Les champs sans étiquette ni formatage gardent leurs contrôles et
valeurs chaîne. Un dépôt d’étiquette ou une commande de formatage promeut le
champ ciblé vers l’éditeur Tiptap compact ; son contenu est enregistré en JSON
Tiptap. Les anciennes chaînes contenant déjà un token de profil sont promues en
nœuds texte et étiquette par la migration. Les autres chaînes restent simples.
Les transactions passent par les commandes et l’historique Elcé. Une Input Rule
peut aider à saisir un token, mais la résolution du lecteur ne rescane pas le
DOM de l’éditeur.

Les Cartes projettent actuellement chaque champ comme une chaîne dans un perso
`tag`. Le contrat CodPlay du service `content` applique une chaîne avec
`textContent`, pas comme un fragment HTML. Le rendu enrichi utilise donc les
persos texte riche Elcé/CodPlay pour les plages formatées et un perso Elcé
distinct pour chaque lien. Les segments sont placés dans l’ordre du document
sur des ancres commentaire Elcé de la zone. Les liens émettent l’événement de
sélection de page déjà utilisé par le menu ; Sighty applique les routes et
gardes existantes. Aucune chaîne auteur n’est interprétée comme du HTML et le
cœur CodPlay n’est pas modifié.

Les propriétés résident sur le nœud Tiptap : profil (`profilePropertyId`),
lien (`pageId`, libellé facultatif, présentation `text | button`) ou date
(type, décalage éventuel). Un lien sans libellé suit le titre courant de la
page. Une copie du nœud est une occurrence indépendante ; aucun registre
d’instances n’est nécessaire.

## Fonctionnalités à livrer

1. **Catalogue d’étiquettes dans « Contenus ».** Regrouper les propriétés de
   profil, les pages internes et les dates. Chaque élément compatible se dépose
   dans le champ actif ; conserver aussi l’insertion au clic et la
   sélection/caret. Étendre le circuit partagé existant plutôt que créer un
   panneau par type de BDC. **Décision d’interface acceptée :** dans « Liens
   vers les pages », choisir la destination dans un sélecteur unique puis
   utiliser un bouton unique pour insérer ou glisser le lien ; ne pas afficher
   un bouton par page. Le bouton reste désactivé tant qu’aucune cible n’est
   choisie.
2. **Étiquettes visibles dans tous les champs textuels.** Inventorier les
   textes métier éditables, dont les champs de Carte, Question, Graphe,
   Résultat, Section, Sommaire, chapitres et pages. Afficher une étiquette
   identifiable dans l’éditeur au milieu du texte ; garder la référence stable
   dans le document et préserver les commandes et l’historique Elcé. La
   référence de profil actuelle reste lisible pendant la migration. Un champ
   simple reste un `input` ou `textarea` jusqu’au dépôt d’une étiquette ; ce
   dépôt le transforme en éditeur Tiptap compact. Un champ promu reste éditable
   en Tiptap tant qu’il est affiché. Tant qu’un champ reste simple, il est
   stocké comme chaîne ; après promotion, il est stocké comme JSON Tiptap, avec
   le texte déjà saisi converti en nœuds texte.
3. **Formatage riche du Message Carte.** Le champ Message accepte le gras et
   l’italique par une barre compacte propre à ce champ. Les autres champs Carte
   n’activent pas de marques. Les marques survivent à l’enregistrement, à la
   projection, aux changements de layout, à l’annulation/rétablissement et à la
   preview. La limite existante de 250 caractères compte le texte UTF-16 et
   chaque nœud-étiquette comme un caractère, indépendamment de sa valeur
   dynamique.
4. **Variables de profil et dates locales.** Résoudre les propriétés de profil
   existantes et proposer la date locale du jour, l’heure locale courante et une
   date relative avec décalage signé en jours. Les dates suivent la locale du
   navigateur. Une projection capture une seule horloge ; les dates relatives
   avancent par calendrier local, y compris lors d’un changement d’heure.
5. **Liens internes vers les pages.** Insérer une cible par identifiant stable
   de page, avec titre de page par défaut ou libellé libre et les deux styles
   demandés : lien texte souligné ou bouton. Dans la preview, le lien emprunte
   la navigation Elcé et garde les contraintes de profil, de chapitre et
   d’évaluation.
6. **Projection et rendu inline dans la preview.** Résoudre les étiquettes à
   partir du document auteur dans la projection du lecteur, sans modifier la
   source. Rendre les valeurs comme texte sûr et les liens comme éléments de
   navigation ; ne pas interpréter une chaîne fournie comme du HTML. La preview
   synchronisée montre immédiatement une correction d’étiquette.
7. **Cycle de vie des références.** Copie, collage, duplication et déplacement
   conservent les attributs du nœud comme valeur locale. Une page supprimée
   retire la destination : le lien reste en texte, avec son libellé libre ou le
   dernier titre connu, sans action de navigation.
8. **Édition d’une étiquette déjà posée.** Un clic sur une étiquette Tiptap
   sélectionne son nœud et ouvre « Variables » sur un onglet d’édition distinct
   de l’onglet de création. L’édition n’affiche que les attributs de l’étiquette
   sélectionnée : pour un lien-bouton, la cible, le libellé et la présentation ;
   pour un profil ou une date, les seuls champs propres à ce type. « Mettre à
   jour » écrit les attributs sur le nœud sélectionné par la transaction de
   l’éditeur existant, afin de conserver le circuit de document et d’historique,
   puis conserve la sélection pour garder le formulaire ouvert. L’onglet de
   création garde le catalogue des insertions séparé. La sélection d’un autre
   contenu ferme l’édition de l’étiquette.

### Raccord retenu pour les liens dans les champs simples

Les builders convertissent le JSON Tiptap en segments structurés. Les plages de
texte formaté passent au composant `text` existant avec un HTML sérialisé depuis
les nœuds Tiptap ; les liens deviennent des persos `tag` Elcé individuels, avec
leurs événements et leur libellé texte. Le builder ajoute une ancre commentaire
par segment dans la zone, dans l’ordre du document. Un lien émet un événement
de navigation Elcé distinct du menu, afin que les gardes identifient son origine
sans confondre un clic de navigation dans le Sommaire. Ce raccord emploie les
contrats existants de placement et de navigation et n’ajoute aucun chemin
CodPlay parallèle.

### Règles d’accès aux liens — validées le 2 novembre 2026

- Chaque page propose toujours un réglage « Autoriser à quitter avant la fin de
  lecture », même si elle ne contient aucun lien. Il autorise Suivant et les
  liens de page à contourner le blocage séquentiel de la page source ; il ne
  modifie pas la progression enregistrée.
- Sans choix explicite, ce réglage est activé si un lien interne existe dans
  les BDC de la page, y compris leurs BDC enfants ; sinon il est désactivé.
  L’auteur peut activer ou désactiver le réglage sur chaque page. La valeur
  stockée distingue un choix explicite de la valeur automatique.
- Le clic sur un lien interne autorise l’accès à sa destination même si la
  progression séquentielle la verrouille. Cette exception ne marque pas la
  destination comme lue et ne retire pas les gardes de profil, de prérequis de
  chapitre ou de résultat d’évaluation.
- Le contournement côté source ne supprime pas les seuils d’évaluation. Le
  mode global `free` garde son comportement existant.

### Espacement des boutons inline — validé le 2 novembre 2026

Un lien présenté comme bouton garde un espace visuel minimal de `0.5em` entre
son bord et le texte voisin, dans l’éditeur comme dans le lecteur. Cet espace
est un style de présentation ; il ne réécrit pas le texte auteur.

Brave confirme `7.04px` de chaque côté dans l’éditeur à `14.08px` et `7.2px`
de chaque côté dans la preview à `14.4px`. Le test de composition lecteur
verrouille la marge de `0.5em` ; typecheck et build passent.

### Emplacement du réglage de lecture — validé le 2 novembre 2026

Placer le réglage de page dans l’onglet « Style » du panneau droit, lorsque la
cible du panneau est cette page. Retirer la case du centre de l’éditeur. Le
libellé devient « Ignorer la contrainte de lecture » ; son défaut automatique,
ses choix explicites et la commande documentaire restent ceux du contrat
existant.

Le test `appearance-panel.test.tsx` vérifie l’affichage dans Style et la
commande, et `page-editor.test.tsx` vérifie l’absence de la case dans la zone
centrale. Le parcours Brave du 2 novembre sur « Test Elcé — liens et date »
confirme que le bouton de style ouvre l’onglet droit « Style », que la case
porte le libellé retenu et reste cochée par défaut sur une page contenant un
lien interne. Le typecheck et les deux fichiers de tests ciblés passent.

## Choix techniques

1. **Valeur enrichie.** Utiliser `RichTextDocument` pour un champ promu et les
   chaînes existantes pour les autres. La version documentaire v8 migre les
   textes v7 déjà munis de `{{profile:<id>}}` vers les nœuds Tiptap
   correspondants ; le texte simple reste inchangé. À la première promotion,
   parser le texte existant et préserver exactement son ordre autour du nouveau
   nœud.
2. **Nœuds d’étiquette.** Stocker directement sur chaque nœud inline les
   attributs de profil, de page ou de date. Ne pas introduire un registre
   global ni un identifiant d’occurrence : une copie porte ses propres attributs
   et ne partage pas sa configuration avec le nœud source.
3. **Éditeur.** Garder le champ natif tant qu’il est texte simple. Au dépôt,
   promouvoir seulement ce champ et monter son éditeur Tiptap compact. Réutiliser
   les commandes Elcé et son historique ; les seuls enrichissements de Carte
   activés dans cette tranche sont gras et italique sur Message.
4. **Liens.** La cible est l’identifiant stable de page. Sans libellé auteur,
   l’étiquette suit le titre courant ; un libellé saisi devient un remplacement
   explicite. Le style par défaut est le lien texte souligné, avec le style
   bouton sélectionnable. L’activation passe par la navigation du lecteur et
   ses gardes. Une cible absente reste visible comme texte sans navigation.
5. **Dates.** Résoudre la date du jour, l’heure locale et les décalages relatifs
   depuis l’horloge et le fuseau locaux du lecteur. La présentation suit la
   locale du navigateur. Toutes les étiquettes d’une projection utilisent le
   même instant capturé et les offsets suivent le calendrier local.
6. **Champs texte.** Tous les textes métier éditables sont des cibles, pas les
   seules cibles profil déjà marquées dans l’interface. La migration et les
   adaptateurs couvrent les titres du document, les champs BDC et les Sections.
   Le texte du bouton de validation Question accepte les propriétés de profil
   et les dates ; il n’accepte pas de lien de page.

## Règle d’interaction appliquée

Le libellé de validation d’une Question appartient au bouton « Valider ».
Conformément au choix confirmé le 2026-10-30, ce champ reste compatible avec
les variables de profil et les dates locales ; le catalogue y masque les liens
de page. L’insertion, le collage et le glisser-déposer ignorent aussi ces liens
dans ce champ afin de préserver une seule action interactive.

## Plan d’exécution

1. Étendre le modèle des champs textuels, la migration documentaire et le
   sérialiseur de nœuds Tiptap.
2. Adapter le panneau partagé et les champs auteur : dépôt avec conservation du
   point d’insertion, promotion paresseuse et commandes Message.
3. Étendre la projection lecteur aux propriétés de profil, dates locales et
   liens ; matérialiser les segments inline dans les builders Elcé sans HTML
   provenant d’une chaîne auteur.
4. Relier les liens aux gardes de page existantes et garder la synchronisation
   immédiate de la preview.
5. Valider migration, édition, rendu Carte/Section/autres cibles, navigation,
   persistance et export concerné ; reporter le comportement vérifié dans les
   spécifications propriétaires et fermer ce plan après acceptation complète.

## Acceptation

- Les mêmes références s’affichent comme étiquettes dans les champs ordinaires
  et Section, puis comme valeurs ou liens dans la preview, sans mutation des
  données auteur.
- Le groupe « Liens vers les pages » présente une liste déroulante de
  destinations et un seul bouton d’insertion, activé après sélection ; aucun
  bouton individuel n’est rendu par page.
- Les Cartes couvrent les champs texte visibles du layout courant ; le test
  comprend les champs simples déjà déclarés et une Carte avec du texte avant et
  après une référence en ligne.
- Le Message Carte conserve le gras et l’italique dans l’éditeur, le document
  enregistré et le player. La migration d’un message existant en texte simple
  conserve exactement son contenu ; le compteur limite texte UTF-16 et nœuds
  étiquette selon la règle retenue.
- Insertion, glisser-déposer, saisie éventuelle, copie/collage, déplacement,
  annulation/rétablissement et rechargement préservent les références et le
  caret dans chaque type de champ retenu.
- Un clic sur une étiquette de profil, un lien interne ou une date déjà posée
  ouvre ses attributs dans « Variables » ; leur mise à jour conserve le type,
  le texte alentour et l’historique du document. Après validation, le nœud reste
  sélectionné et le formulaire reflète ses attributs modifiés. Un clic sur du
  texte ordinaire ou sur une autre cible d’édition quitte l’édition de
  l’étiquette.
- Les liens internes ciblent la page attendue, reflètent les changements de
  titre lorsque leur libellé est automatique et suivent le comportement d’accès
  qui sera validé pour la page source et la destination.
- Un bouton interne laisse au moins `0.5em` de séparation avec le texte placé
  immédiatement avant ou après, dans l’éditeur Tiptap et la preview.
- Pour une cible page, le panneau droit affiche « Ignorer la contrainte de
  lecture » ; le centre de l’éditeur ne porte plus cette case. Son changement
  utilise la commande `page.early-exit.set` existante.
- Une propriété de profil absente sans défaut produit une chaîne vide ; la date
  du jour, l’heure locale et les offsets relatifs utilisent l’horloge et la
  locale du lecteur, avec un même instant par projection.
- Un lien vers une page supprimée reste visible avec son libellé libre ou son
  dernier titre connu, mais ne propose aucune destination.
- Le parcours est vérifié dans la preview Elcé réelle et l’export concerné ;
  une vérification isolée du parseur ou du composant Tiptap ne suffit pas.

## Validation intégrée — 2026-11-02

Le parcours a été réalisé dans Brave sur la copie locale `Test Elcé — liens et
date`, chargée depuis son identifiant exact et migrée de v8 à v9. Le chargement
initial de l’éditeur échouait sur un import local sans extension du module
`tiptap-content` ; l’import explicite de `tiptap-content.ts` corrige le 404,
et l’éditeur s’ouvre après rechargement.

Dans la page « Repérer les grandes formes — itération 3 », le catalogue a
inséré le lien bouton « Distinguer les plans » dans la Section. Après
rechargement de l’éditeur, le lien est toujours présent. La preview affiche
son bouton ; son activation ouvre la page 2 « Distinguer les plans », puis
« Précédent » revient à la page 1.

Une Carte a été ajoutée à cette page. Son champ Message est promu en Tiptap à
l’insertion de « Date du jour » ; l’étiquette reste visible dans l’éditeur
après rechargement. La preview rend la date locale française `02/11/2026` dans
le Message de cette Carte.

Après l’ajout de la sortie anticipée, les validations ciblées passent : 32 tests
dans cinq fichiers, trois tests SQLite sur la migration v8 → v9 et l’aller-retour
des réglages, le typecheck et le build. Le parcours Brave confirme le clic du
lien avant la fin de la source et le retour Précédent. Le réseau du chargement
actuel retourne aussi le module `workspace-panel-state.ts` en 304 ; le 404
initial de ce module ne se reproduit plus. Le build signale encore un bundle
JavaScript supérieur à 500 kB. Une suite complète et l’export n’ont pas été
relancés dans cette validation. Les comportements vérifiés sont décrits dans
les spécifications du modèle et du Sommaire/progression ; le plan reste En
cours pour les autres champs, formats, gestes d’édition, export et cas de
migration de l’acceptation.

### Présentation du catalogue Variables et Liens — appliquée et vérifiée le 2 novembre 2026

Les groupes de pages et de dates ont le même rythme vertical. Les champs,
sélecteurs et commandes d’insertion partagent largeur, hauteur, typographie,
couleurs, bordure et rayon ; l’action de lien désactivée reste visuellement
distincte. Le sélecteur de page garde sa commande d’insertion unique.

Brave vérifie cette présentation sur « Test Elcé — liens et date » à 855 px :
les contrôles font 36 px de haut, utilisent une typographie de 12,16 px, et
gardent le bouton de lien désactivé sans cible. Le comportement d’insertion
reste inchangé.

### Édition d’une étiquette déjà posée — appliquée localement, synchronisation à valider le 2 novembre 2026

Le clic sur un atome Tiptap ouvre « Variables » sur ses attributs. Le formulaire
modifie les attributs du nœud par l’adaptateur existant de la Section ou du
champ inline, vérifie que le nœud correspond encore à la sélection, puis garde
ce nœud sélectionné. Les contrôles de profil, de lien et de date gardent leurs
valeurs courantes et disposent d’une action « Mettre à jour l’étiquette ».

Les 17 tests ciblés couvrent les trois types d’étiquette, l’événement de
sélection et l’appel de changement documentaire. Le typecheck passe. Brave confirme le
clic d’un lien dans la Section et l’édition locale de son libellé ; le panneau
reste ouvert avec la nouvelle valeur. L’API de test répond HTTP 400 à
`PUT /api/projects/:projectId/document` (corps de réponse indisponible), et
l’accès rechargé au document de test est en lecture seule. Le libellé du
document de test a été remis à sa valeur initiale localement. L’acceptation de
la persistance serveur reste ouverte ; le plan reste En cours.

### Séparation des onglets de création et d’édition — appliquée et vérifiée le 2 novembre 2026

Quand une étiquette est sélectionnée, « Variables » s’ouvre sur « Modifier » ;
« Créer » reste un onglet distinct qui conserve le catalogue complet. L’édition
ne présente que les champs du type sélectionné. Pour un lien-bouton, elle garde
la cible, le libellé, la présentation et l’action de mise à jour.

Les 14 tests ciblés dans `profile-token-insertion.test.tsx` et
`project-application.test.tsx`, le typecheck et `git diff --check` passent.
Dans Brave, le document de test montre l’onglet « Modifier » actif et uniquement
les champs du lien sélectionné. Cette vérification n’a modifié ni le document
ni sa synchronisation serveur.
