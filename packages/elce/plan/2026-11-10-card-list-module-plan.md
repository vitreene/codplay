# Plan — Module Liste, intégré aux Cartes en V1

**Statut : En cours — périmètre V1 fixé ; validation et consolidation des spécifications restantes.**

## Objectif

Créer un sous-module générique Liste, indépendant des Cartes et réutilisable
dans d’autres parties du projet. En V1, la ressource Carte est son seul hôte :
l’entrée d’interface « Liste à points » crée une Carte qui expose tous les champs texte
Carte et compose le sous-module.

Le module Liste possède ses données, règles, contrôles d’édition et projection
générique. L’hôte possède son stockage, sa création, son placement et les
événements qui déclenchent son apparition.

## Décisions fonctionnelles

- Le nom visible est **Liste à points**.
- « Liste à points » reste un BDC Carte avec une présentation `list-basic` dédiée ; ce
  n’est pas un nouveau type de BDC.
- Le module générique vit dans `resources/list/`, hors de
  `resources/bdcs/card/`. Ses types, règles, éditeur et constructeur de scène
  ne dépendent ni de `CardContent`, ni d’un preset Carte, ni de Learning ou
  Quiz Hunt. L’adaptateur d’hôte fournit les identifiants, les commandes, le
  stockage et le signal d’apparition.
- Chaque Carte conserve son `presetId`, ses champs, son média, sa Révélation et
  son apparence. Le sous-module n’en remplace aucun.
- En V1, les Cartes ordinaires n’ont pas de commande pour activer la Liste.
  L’entrée « Liste à points » du menu d’ajout appelle la création Carte existante avec
  `list-basic` et initialise le sous-module. Elle est proposée aux emplacements
  où Learning permet déjà d’ajouter une Carte autonome ou une Carte enfant de
  Carousel.
- En V1, l’adaptateur Carte est le seul point de composition du module. La
  présentation `list-basic` est un choix propre à cet hôte ; le module Liste ne
  connaît pas cet identifiant. La présentation « Liste à points » n’est pas proposée
  comme conversion aux Cartes qui
  n’ont pas déjà le sous-module. Si une Carte Liste passe à un autre layout,
  ses données de liste restent conservées et « Liste à points » reste sélectionnable sur
  cette même Carte. Le sélecteur ne montre cette option de retour que pour cette
  Carte.
- L’éditeur Liste expose les six champs texte Carte : surtitre, titre,
  description, message, note et légende. Le contrôle Liste à points et son
  contenu sont placés après Message et avant Note.
  Les lignes ont un identifiant stable et un texte simple, comme les réponses
  éditables d’une Question ; les champs Carte existants gardent leur format
  `ElceTextValue`.
- L’interface des lignes reprend les commandes de la Question : ajouter,
  supprimer et réordonner par glisser-déposer. Elle ne reprend ni le marquage
  des bonnes réponses ni les règles de correction.
- La création initialise une Liste avec une ligne vide, le préfixe Disque et
  un intervalle commun de `0 ms`. Une Liste vierge reste éditable et ne produit
  pas de ligne visible en lecture. La Liste entière est supprimée en supprimant
  sa Carte ; cette suppression reste annulable par l’historique documentaire.

## Préfixes et temporisation

La configuration enregistrée utilise des choix métier stables et les projette
vers le HTML/CSS du player ; elle ne stocke pas de déclaration CSS libre.

- **Aucun** : `list-style-type: none`.
- **Disque** et **Carré** : listes `ul` avec `list-style-type: disc` ou `square`.
- **Tiret** : liste `ul`, avec le contenu de marqueur rendu par `::marker`.
- **Lettre (a.)** : liste `ol` avec `list-style-type: lower-alpha`.
- **Numéro** : liste `ol` avec `decimal` ou `lower-roman` et un attribut
  `start` entier, initialisé à `1`.
- **Marqueur personnalisé** (bonus) : un caractère visible, dont un emoji, est
  rendu dans `::marker`. La valeur reste du texte et ne peut injecter du CSS.

Le délai commun de la Carte est l’intervalle par défaut entre les lignes. Une
ligne peut remplacer cet intervalle par son propre délai avant apparition. Le
délai de la première ligne est relatif à l’entrée de la Carte ; celui des lignes
suivantes est relatif à l’apparition de la ligne précédente. Sans réglage
particulier, la première ligne apparaît à l’entrée et les suivantes suivent
l’intervalle commun. Les délais sont des nombres finis positifs ou nuls.
L’interface utilise les secondes, unité temporelle par défaut d’Elcé, pour
l’intervalle commun et les délais particuliers, avec un pas de `0,1 s`.
L’éditeur convertit ces valeurs vers les millisecondes du modèle existant.

La lecture réutilise le signal d’entrée et la transition d’introduction déjà
résolus pour la Carte. Pour une entrée déclenchée par un événement live, un
strap du module Liste programme un événement CodPlay par ligne au moyen de
`context.planned.wait`. Pour une entrée inscrite au calendrier statique de la
scène — Diapo et Carousel automatique — les `eventimes` compilés fournissent
directement des occurrences temporelles aux actions des lignes ; ils ne passent
pas par `RuntimeEventDispatcher` et ne déclenchent pas `listen`. Dans ce mode,
le module ne déclare donc ni strap ni règle `listen` pour le signal d’entrée.
Le délai d’une ligne est cumulé depuis l’apparition précédente, selon
l’intervalle de la Carte ou le délai particulier de la ligne. Chaque occurrence
révèle une ligne par une `TweenAction` CodPlay qui fait passer son opacité de
`0` à `1` en `200 ms` linéaires ; le signal de sortie la masque pour préparer
une nouvelle lecture. Pour une entrée live, le strap conserve les instants de
révélation attendus et programme les corrections nécessaires à la sortie ou à
la réentrée. La durée du fondu est indépendante du délai entre les lignes. La
progression suit le temps de lecture CodPlay et se reconstruit par Seek. La
feuille CSS ne porte ni délai ni animation ; aucun minuteur navigateur n’est
ajouté. Ce raccord réutilise la `TweenAction` existante et ne demande pas de
changement du cœur CodPlay. Si le player ne matérialise pas sa progression à
chaque frame de lecture, arrêter ce raccord et faire accepter un plan CodPlay
avant toute modification du cœur.

## Collage d’une liste

Le bonus de collage reconnaît les listes HTML `ul`/`ol` et les marqueurs de
liste à un seul niveau dans le texte brut (`•`, `-`, `*`, `1.` ou `1)`). Le
collage dans une ligne reconnue remplace cette ligne par une série de nouvelles
lignes au même endroit. Les voisins gardent leur identifiant et leur ordre ; la
configuration de préfixe et d’intervalle de la Carte ne change pas. Le collage
ordinaire non reconnu suit le comportement normal du champ. Si le texte brut
décrit davantage d’éléments reconnus que la représentation HTML du presse-papiers,
le collage conserve la liste complète en texte brut. Les marqueurs de puce
consécutifs et les tabulations encodées en `&#9;` restent des séparateurs, pas
du texte de ligne. Le cas de reproduction à accepter fournit deux lignes dans
`text/html` et trois marqueurs reconnus dans `text/plain` ; les trois lignes
doivent être créées dans l’ordre, dont « et, donc, proposition d’une étude pour
les autres logements ».

## Raccords et propriétaires

1. **Module générique.** Créer `resources/list/` avec `domain/list-types.ts` et
   `domain/list-service.ts` pour les valeurs, invariants et opérations sur les
   lignes ; `authoring/list-editor.tsx` pour l’interface réutilisable ; et
   `reading/list-scene-builder.ts` avec sa feuille de style pour la structure
   HTML sémantique et les marqueurs. Le module reçoit ses données, un callback
   d’édition, un générateur d’ID, un préfixe d’identifiants et les noms
   facultatifs des événements d’entrée et de sortie ; il n’importe aucune
   façade ni donnée Carte. Garder les règles de collage dans ce module.
2. **Adaptateur Carte.** Ajouter `CardContent.list: ListContent | null` et
   `CARD_PRESET_ID.LIST` (`list-basic`) aux identifiants/presets Carte. Le
   module n’en dépend pas : le preset Carte ne fait que fournir son point de
   composition, ses six champs texte et ses styles d’hôte. Garder `list-basic`
   hors des options de création ou de conversion génériques.
3. **Commandes et création.** L’adaptateur Carte délègue les règles à
   `ListService` et transporte le payload par la commande Carte existante
   `bdc.card.update`. Étendre les options de `bdc.create` pour que l’entrée
   « Liste à points » initialise le preset et le payload en une seule création annulable.
   Étendre les invariants Learning sans nouveau type de BDC ni commande parallèle.
4. **Interface hôte.** Le panneau Carte compose `ListEditor` en lui passant
   les données et actions fournies par `ElceCardFacade`. Il n’ajoute pas de
   contrôle d’activation aux layouts ordinaires. Brancher l’entrée de création
   dans `learning-page-editor.tsx` et le menu d’ajout de vues du Carousel.
   Quiz Hunt conserve l’accès au modèle/preset partagé, au rendu et à la
   persistance via les adaptateurs Carte communs ; aucun circuit Liste propre à
   Quiz Hunt n’est ajouté en V1.
5. **Rendu hôte et temps.** `ListSceneBuilder` produit des `ul`/`ol`, des `li`,
   les actions des lignes et les deux projections temporelles sans connaître
   Carte. Le builder Carte compose cette projection dans `list-basic` et lui
   transmet le signal d’entrée/sortie et son mode (`live` ou `compiled-eventime`)
   résolus par le parcours Flux, Diapo ou Carousel. Les entrées live incorporent
   les straps et règles `listen` ; les `eventimes` statiques produisent des
   occurrences qui appliquent directement les actions, sans `listen`. Une vue
   initialement visible peut commencer avec ses lignes visibles immédiatement.
   En Flux, une Carte Liste demande `initial: 'enter'` à l’observation de sa
   racine afin que la première mesure dans la zone déclenche le même signal
   d’entrée que les entrées ultérieures ; les autres layouts Carte conservent
   leur observation initiale actuelle. Quiz Hunt conserve le rendu commun sans
   ajouter de circuit de lecture propre.
   Ajouter les règles d’apparence neutres à la feuille du module Liste ; garder
   dans l’hôte les dimensions et l’emplacement de la zone.
6. **Persistance et migration.** Le module ne dépend pas de SQLite ; son hôte
   persiste son payload. Étendre les helpers SQL Carte avec une colonne JSON
   nullable et une migration réversible. Les lignes historiques se relisent avec
   `list: null`. Porter le document Learning de la version courante 14 à 15 et
   migrer v14 en initialisant `list` à `null`. Vérifier les helpers communs pour
   Learning et Quiz Hunt.
7. **Références internes.** Après validation, consolider le contrat dans
   `specs/carousel-bdc-spec.md` et remettre à jour la partie modèle/persistance
   de `specs/document-model-spec.md`, qui décrit encore une version v10 alors
   que le code courant est v14. Ne pas créer une spécification par intervention.

## Acceptation

- Créer depuis « Liste à points » produit un BDC Carte `list-basic`, avec le sous-module
  initialisé et les six champs texte visibles. Le menu de conversion des Cartes
  ordinaires ne permet pas de choisir `list-basic`.
- Les types, le service, l’éditeur et le constructeur de scène de
  `resources/list/` ne dépendent d’aucun module hôte. La Carte n’apporte que
  l’adaptateur de composition en V1.
- Une Carte Liste à points peut passer à un autre layout puis revenir à
  « Liste à points » sans
  perdre ses lignes, préfixes ou délais. Les autres Cartes ne disposent pas
  d’une commande pour activer le sous-module en V1.
- Ajouter, éditer, supprimer et réordonner les lignes conserve leurs IDs et
  leurs textes. Les lignes vides ne s’affichent pas en lecture.
- Chaque choix de préfixe produit la forme attendue et une structure HTML
  sémantique `ul`/`ol` contenant des `li`. Le début de numérotation, les chiffres
  arabes et romains, le tiret et un marqueur emoji sont vérifiés.
- L’intervalle commun et les délais individuels donnent un ordre d’apparition
  reproductible à l’entrée de la Carte, y compris après retour, Play, seek et
  replay dans les parcours pris en charge.
- Chaque signal de révélation anime l’opacité de sa ligne de `0` à `1` sur
  `200 ms` via `TweenAction` CodPlay ; la progression est visible pendant Play
  et reconstruite aux positions correspondantes par Seek et replay. Le signal
  de sortie masque les lignes et une nouvelle entrée relance leur apparition.
- Les eventimes compilés de Diapo et Carousel automatique déclenchent les
  actions de ligne sans ajouter de `listen` ni de strap pour ces eventimes ; les
  entrées live de Flux et Carousel manuel programment les lignes par straps et
  `context.planned.wait`.
- Le collage d’une liste HTML ou texte reconnue remplace la ligne ciblée par
  les bonnes lignes ; le texte voisin, le préfixe et le réglage d’intervalle
  restent intacts.
- Les tests couvrent le service, la commande, le rendu, l’éditeur partagé,
  l’historique Annuler/Rétablir et la persistance/migration Learning et Quiz
  Hunt. Les intégrations couvrent Carte directe Flux/Diapo, Carte de Carousel
  Flux/Diapo et Cartes de résultat Quiz Hunt.
- La validation player réelle couvre les tailles large et mobile, les entrées
  répétées de Carte, la synchronisation preview, l’export et les layouts qui
  auront été retenus. Compléter par typecheck, tests et build depuis le paquet
  Elcé. N’exécuter la validation navigateur qu’après vérification du serveur
  MCP et de l’inventaire d’outils réellement disponibles dans la session.

Cette tranche ne modifie pas CodPlay core. Toute impossibilité constatée dans
le circuit actuel reste un point de décision explicite ; elle ne se contourne
pas par un circuit de lecture ou un comportement propre à une démo.
