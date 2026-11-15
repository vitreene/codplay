# Plan d’exécution — synchronisation décor/projection et rotation Editor

## 0. Statut, objectif et autorisation

**Statut : A relire.** Ce document prépare une exécution par un autre agent.
L’utilisateur a suspendu les corrections pour demander l’analyse et ce plan.
Sa rédaction n’autorise pas à reprendre l’implémentation avant sa validation.

**Résultat attendu :** toute modification acceptée, issue du décor, d’un CS,
de la trajectoire ou d’un autre outil, se répercute immédiatement sur le même
candidat Decor, les contrôles concernés, l’item rendu et ses projections.
La rotation doit rester continue pendant le geste, au relâchement, au commit,
après reconstruction, au Seek, au Play et au resize, à la racine comme dans
une capsule tournée. Le document reste auteur, en cqw ; sa projection ne
devient jamais une seconde source d’écriture.

**Référence utilisateur à préserver : l’interface de trajectoire fonctionne ;
la rotation est défectueuse.** Une architecture modifiée qui casse le tracé,
la poignée, les ghosts, les interactions ou le chemin persistant est refusée.
La convergence interne ne demande pas une nouvelle interface de trajectoire.

**Périmètre autorisé après validation du plan :** package Editor, ses tests et
ses documents internes. Réutiliser les fonctions de CodPlay/ACE et les outils
authoring existants. **Aucune modification de `packages/codplay`**, aucune
nouvelle implémentation de player, aucun circuit de synchronisation parallèle.
Ne pas modifier `packages/authoring/selection-frame` pour compenser un problème
d’adaptation Editor ; un besoin démontré à cette frontière exige une revue
distincte de son contrat avant modification.

L’[analyse](./notes/2026-10-29-editor-path-playback-analysis.md) conserve le
raisonnement. Ce plan doit suffire à exécuter le travail sans relire la
conversation ni reconstruire les décisions depuis les notes.

## 1. Références à lire avant le code

Lire `AGENTS.md` à la racine, puis les références suivantes dans cet ordre :

1. [Intégration Editor V2](../specs/editor-v2-integration-spec.md) : propriétaires,
   preview, phases, temps auteur et temps player, chargement et reconstruction.
2. [Présentation des items](../specs/item-presentation-spec.md) : perso unique,
   cadre motion/ancre privée/contenu, insets, snapshot et inverse de preview.
3. [Orientation de trajectoire](../specs/path-tangent-orientation-spec.md) :
   `path` et `orientToPath` segment-locaux, ancre, ghosts et indépendance des visites.
4. [Interpolation de décor](../specs/decor-style-interpolation-spec.md) et
   [modèle documentaire](../specs/editor-document-model-spec.md) : héritage,
   styles ouverts, offsets, contenu et partage des décors.
5. Contrats de consommation CodPlay, en lecture seule :
   [move](../../codplay/specs/move-v2-spec.md),
   [motion](../../codplay/specs/motion-frame-v2-spec.md),
   [façade](../../codplay/specs/facade-v2-spec.md),
   [unités](../../codplay/specs/unit-values-v2-spec.md),
   [transformations](../../codplay/specs/transform-properties-v2-spec.md),
   [calculs ACE](../../codplay/specs/ace-calculation-v2-spec.md).

Les specs restent l’autorité du comportement vérifié. Les changements proposés
ici ne deviennent des contrats vérifiés qu’après implémentation et acceptation.
Une lacune de contrat bloque la partie qui en dépend ; la documenter ici avant
de demander une décision, sans inventer une API ou changer CodPlay.

## 2. État de départ à ne pas interpréter comme une solution

Le workspace contient des changements antérieurs, dont création, visibilité,
ordre, layout et rotation. Ne pas faire de reset, revert global ou nettoyage
général. Relire le diff des fichiers concernés pour isoler la rotation et
préserver les autres travaux.

Le bridge comporte notamment `authorFramePx`, `displayFramePx`, les bases de
geste et `frameCommitCandidatePx`, avec des modifications provisoires autour
de `frameGestureBaseAuthorFrame`. Elles nécessitent une revue : les noms ne
prouvent pas que les valeurs ont le bon repère ou la bonne autorité.

Les précédents résultats de tests isolés ne constituent pas l’acceptation de
la rotation. Les observations `48° → 53°`, puis environ `35,381°` après refresh,
sont des symptômes, pas des valeurs de référence à préserver. Ne pas en
déduire automatiquement un défaut de CodPlay ni une formule compensatrice.

La scène SQLite de l’utilisateur n’est pas une fixture de test. Ne pas la
réécrire pour obtenir un résultat attendu. Préparer des fixtures propres ;
utiliser l’application réelle pour la vérification d’intégration, en annulant
les gestes de contrôle effectués sur une scène utilisateur.

## 3. Architecture cible dans les propriétaires existants

### 3.1 Autorités

| État ou opération | Propriétaire à conserver | Effets permis |
|---|---|---|
| Document, sélection, commandes et historique | Contrôleur central et `EditorActionsFacade` | Une commande ou transaction explicite ; copy-on-write et Undo/Redo existants |
| Base et modifications d’une édition de décor | `DecorEditorController` et registre du bridge décor | Résolution de la base et patch sparse, pas une copie documentaire concurrente |
| Adaptation du geste et conversions | `decor-editor-bridge.ts` + `motion-editor` | Candidat auteur, pose projetée et géométrie commune, sans persistance en pixels |
| Projection temporaire | Coordination → façade player → `snapshot.set/clear` → `ItemComponent` | Présenter le candidat, sans changement du journal ou du document |
| CS, route, ghosts | `MotionGeometryStore` | Consommer une publication cohérente du résultat retenu |
| Compilation, ressources et instances | `scene-player-bridge.ts` | Builder, staging, remplacement et destruction ; pas de calcul auteur de secours |
| Temps auteur et commandes de transport | Sequence Editor, coordination et façade player | Ports existants et passage auteur/player ; pas d’entrée Undo pour le transport |

Le renforcement du couplage se fait dans ces propriétaires. Ne pas ajouter de
bus d’événements, store de décor projeté, ordonnanceur global, boucle de
polling, copie d’EditorScene ou chaîne d’écriture spéciale pour les CS.

### 3.2 Chaîne obligatoire d’une modification

`intention → cible/base → patch auteur → résolution commune → application
de preview → publication du résultat accepté → commit du candidat → reprise
de présentation`

Le décor effectif, la pose projetée et la géométrie sont trois résultats liés
de cette résolution. Ils ne doivent pas être reconstruits indépendamment par
la palette, le CS, la route et le composant de rendu.

1. L’adaptateur d’entrée traduit la saisie ou le geste dans le vocabulaire
   auteur. Un geste viewport n’est pas déjà une valeur de Decor.
2. La cible distingue item, KF réel/temporaire et segment entrant. `path` et
   `orientToPath` visent le Decor du KF cible de ce segment, sans héritage de path.
3. La base provient du document au KF exact, ou du snapshot logique du temps
   présenté avec le candidat sparse applicable. `snapshot.get()` exclut la preview.
4. La résolution utilise la même base d’interaction et les propriétés touchées.
   Les previews suivantes ne remplacent pas la base de départ du geste.
5. La preview est envoyée par le port existant. Le contrôle de réussite précède
   l’adoption du candidat comme projection effective. Un refus n’autorise pas
   l’affichage d’un nouveau CS accepté devant un ancien item.
6. Les contrôles relisent le candidat, le store publie CS/route/ghosts et le
   player montre cette même modification dans la présentation navigateur normale.
   La relecture des contrôles n’émet pas un nouveau patch.
7. La fin du contrôle ou du geste persiste ce candidat une seule fois. Ni flush,
   ni commit, ni reconstruction ne redéfinissent la rotation ou la tangente.

« Immédiat » s’évalue pendant `input`/`pointermove`, avant `change`, blur et
pointerup. Aucun debounce, délai d’inactivité ou rebuild par mouvement du
pointeur ne remplace le circuit d’aperçu. Les frontières documentaires existantes
restent explicites ; un déplacement de KF ou une opération structurelle conserve
son chemin documentaire, avec application sans délai ajouté.

### 3.3 Grandeurs et contraintes spatiales

| Grandeur | Définition et règle |
|---|---|
| Rotation auteur | Valeur du Decor ; avec tangente, décalage de référence, pas angle présenté recopié |
| Tangente | Direction résolue au même point, même chemin préparé et même progression eased |
| Angle utile | Orientation de l’item dans le repère de présentation selon le contrat `orientToPath` |
| CS | Contrôle d’édition et contour projeté : nommer leurs rôles sans confondre une consigne avec la valeur auteur |
| Pivot | Fraction locale, incluant `(0,0)` ; pas un angle ni une longueur cqw |
| Ancre de chemin | Centre affine du cadre extérieur avec bordure/padding, fourni par la géométrie commune |
| Parent | Transformation du repère de contenu de la capsule vers le repère de scène, au même temps |
| Longueurs | Auteur/contrôles/sauvegarde en cqw ; pixels uniquement dans la projection temporaire |

Arrondir l’angle absolu commandé par le CS au degré entier. Retrouver ensuite
l’offset auteur adapté ; il peut rester fractionnaire en présence d’une tangente.
Éviter le double arrondi de cet offset. Conserver les degrés jusqu’aux primitives
qui demandent des radians, et normaliser les comparaisons modulo 360.

Une rotation seule garde l’ancre initiale. Pour un pivot décentré ou des insets
asymétriques, la compensation de translation nécessaire appartient au candidat
auteur ; elle ne constitue pas un déplacement indépendant du chemin.

Une modification de couleur conserve la pose. Une bordure, un padding, une
dimension, une échelle ou un pivot invalide les résultats géométriques affectés.
Une modification du path invalide point/tangente/angle utile concernés. Utiliser
les propriétés réellement touchées dans le registre ouvert ; ne pas ajouter
une whitelist de CSS ou une deuxième cascade.

### 3.4 Composition dans les capsules

Réutiliser `multiplyMatrix`, `invertMatrix`, `transformPoint`,
`createTranslateMatrix`, `createRotateMatrix`, `createScaleMatrix` de l’alias
`ace` déjà configuré par Editor. Réutiliser `prepareSvgPath`, `resolvePath`,
`resolvePathFrame` et les fonctions de géométrie de trajectoire existantes.
Ne pas réécrire l’algèbre affine ou la résolution temporelle.

Établir dans les fonctions géométriques existantes les conventions exactes :

- `P` : matrice du contenu du parent vers la scène, avec son origine ;
- `L` : transformation locale auteur de l’item ;
- `K` : changement d’origine contenu/cadre issu des insets et du pivot ;
- `W = P × L × K`, puis retour auteur `L = inverse(P) × W × inverse(K)`.

Cette notation organise les conversions, elle ne dispense pas de vérifier
l’ordre réel des pivots/insets dans les fonctions actuelles. Ne pas ajouter une
seconde correction de bordure. Une conversion cqw/pixels ne retire pas `P`.
Transformer les directions avec la partie linéaire, sans translation.

Pour une capsule simplement tournée de `30°`, une tangente locale de `20°`
et un offset de `10°` donnent une orientation utile de `60°`. Le document garde
`10°`. Deux capsules à `30°` et `−15°` donnent dans ce même exemple `45°`.
Ces additions ne servent qu’aux cas rigides. En général, utiliser les matrices.
Le contrat CodPlay aligne la tangente dans l’espace de présentation : ne pas
remplacer cette sémantique par une convention locale différente.

Conserver la matrice complète pour les calculs. Le CS actuel décompose
rotation/échelles et ne représente pas tout cisaillement : ne jamais utiliser
son approximation comme valeur à persister. Une inverse `null` bloque cette
conversion ; pas de matrice identité de secours. Si le cas exige un nouveau
comportement de contrôle affine, le soumettre à revue avant de modifier le
composant partagé. La rotation simple d’une capsule reste un cas obligatoire.

## 4. Fichiers et modifications délimitées

Tous les chemins ci-dessous sont relatifs à `packages/editor`.

| Fichier/propriétaire | Modification à exécuter | Résultat attendu / limite |
|---|---|---|
| `src/app/bridges/decor-editor-bridge.ts` : `previewFrame`, `onDecorChange`, `setAuthorFrame` | Réordonner l’admission du patch et la résolution du candidat ; supprimer les interprétations concurrentes de la pose | Un même candidat Decor/projection pour la palette et les CS ; aucune deuxième chaîne de preview |
| Même bridge : `resolveTarget`, `resolveGestureMotion`, `resolveDecorEditBase`, `authoredRotationAtGestureStart` | Qualifier cible, temps, segment et provenance de la base | Ne pas écrire le path d’un segment dans un Decor temporaire sans rapport |
| `src/motion-editor/geometry.ts`, `content-box.ts`, `border-insets.ts` | Compléter les conversions aller/retour parent/local dans le domaine existant ; conserver une géométrie partagée | Points, ancre, angles et insets cohérents ; pas de DOM capturé dans les calculs auteur |
| `src/item-presentation/item-preview.ts`, `item-component.ts`, `item-style-projection.ts` | Vérifier repères du candidat et de son inverse, puis appliquer le résultat préparé | Pas de double transformation parent/tangente ; conserver perso unique et cycle natif texte/image/média |
| Bridge décor : `commitMotionDrop`, `commitSelectionFrameDrop`, `flushNow` | Consommer le candidat auteur accepté au lieu de reconstruire depuis le contour | Patch sparse ou capture complète de waypoint selon le contrat existant ; un seul commit |
| `src/motion-editor/overlay.ts` et callbacks de montage du bridge | Seulement après la correction rotation : transmettre les mises à jour au traitement commun si nécessaire au couplage | Préserver le rendu, le geste, `onPathChange` au relâchement et l’unique surface de déplacement |
| `src/motion-editor/geometry-store.ts` | Réutiliser la publication commune ; changer sa forme seulement si une insuffisance est démontrée | Pas de nouveau store ni copie du candidat auteur dans l’overlay |
| `src/app/bridges/scene-player-bridge.ts`, `editor-coordination-bridge.ts`, `src/app/commands/editor-player-command-facade.ts` | Vérifier les rendez-vous de publication et gardes déjà présents ; modifier uniquement la frontière démontrée défectueuse côté Editor | Conserver bind/seek/rebuild et transport existants ; aucune nouvelle boucle de suivi |
| `src/app/bridges/sequence-editor-bridge.ts` | Vérifier consommation/abandon des candidats et snapshot au bon temps | Pas de capture périmée après insertion KF, Seek, Undo ou rechargement |
| `src/builder-v2/build-scene.ts` | Auditer le sens de `rotate`, `path`, `orientToPath`, `rotateOffset` et bornes ; changer seulement une donnée Editor prouvée incorrecte | Ne pas retirer les tweens `x/y` nécessaires aux bornes ni mettre les rotations à zéro par hypothèse |
| `src/decor-editor/controller.ts`, `modified-properties.ts`, `mount.ts` | Réutiliser admission du patch, registre et relecture des contrôles ; adapter seulement ce qui manque à la synchronisation démontrée | Les contrôles ne deviennent ni calculateur de pose ni moteur d’écriture parallèle |

Ne pas réécrire le layout, la timeline, le système d’ordre, les migrations SQLite,
les composants médias ou la distribution des capsules pour cette intervention.
Ils figurent dans les contrôles de non-régression quand leurs frontières sont
exercées. Aucun changement opportuniste dans les fichiers sales du workspace.

## 5. Exécution par étapes, avec portes de passage

### Étape A — état de référence et non-régression trajectoire

**Avant tout changement de code après approbation :**

1. Lire les diffs des fichiers de la section 4 ; distinguer changements
   provisoires de rotation et changements d’autres fonctionnalités.
2. Exécuter les tests ciblés de la section 8 et relever les éventuels échecs
   existants dans le suivi de ce plan. Ne pas modifier les attentes pour les faire passer.
3. Dans l’unique page MCP, constater le fonctionnement du contrôle de trajectoire,
   de la courbe pendant le drag, des ghosts, du reset et de la bascule tangentielle.
   Comparer avant/pendant/après le drag ; le dessin ne doit pas attendre pointerup.
4. Reproduire la rotation sur un KF exact, puis à un temps interpolé. Lire
   séparément l’angle auteur, la pose publiée, le contour CS et le rendu effectif.
5. Préparer les fixtures de la section 7 sans dépendre de la scène utilisateur.

**Sortie exigée :** état de référence des gestes qui fonctionnent, reproduction
du défaut de rotation et test ciblé qui distingue au moins une valeur attendue
d’une valeur incorrecte. Le diagnostic doit être reproductible dans Editor.

### Étape B — trouver la première divergence de valeurs

Pour un seul geste de rotation, suivre dans l’ordre :

| Frontière | Relevé minimal |
|---|---|
| Début du geste | Identités scène/item/parent/KF/segment, temps auteur/player, pose de base, rotation auteur, pivot, insets, ancre, matrice parent |
| Delta du pointeur | Delta cumulatif, angle absolu avant/après arrondi et repère |
| Admission Decor | Base + chemins modifiés, cible de chaque champ, résultat auteur |
| Résolution | Point/tangente/progression eased, matrice locale et présentée, géométrie de contenu et extérieure |
| Preview | Patch snapshot envoyé et résultat ; candidat retenu, palette et publication du store |
| Relâchement | Dernier delta, candidat accepté transmis au commit, commandes exactes |
| Publication | Document obtenu, valeurs Builder envoyées, instance/temps de présentation |
| Refresh / Seek / Play | Valeurs avant et après, contexte auquel elles appartiennent, écriture documentaire éventuelle |

Déterminer la première frontière qui transforme une donnée correcte en donnée
incorrecte. Vérifier les unités, le parent et l’autorité avant d’incriminer une
fonction appelée plus bas. Les mesures DOM appartiennent au diagnostic ou à la
projection transitoire, pas à la reconstitution du modèle auteur.

Instrumenter temporairement seulement ce qui est nécessaire à cette preuve,
sans contourner focus, visibilité, verrouillage ou capture du pointeur. Retirer
ces traces avant livraison. Si aucun port existant ne permet une action requise,
mettre le point précis en revue ; ne pas modifier CodPlay ou inventer une API.

**Sortie exigée :** cause et frontière nommées, données d’entrée/sortie comparables,
et correspondance avec un item de ce plan. Ne pas poursuivre par essais de signes,
d’arrondis, de délais, de seeks compensateurs ou de neutralisation de rotations.

### Étape C — fermer les conversions parent/local

1. Dans les fonctions géométriques existantes, établir les conversions de la
   section 3.4 et leurs tests aller/retour avant de les brancher au geste.
2. Déterminer la référence cqw réellement utilisée dans le parent et dans la
   projection CSS ; ne pas supposer que toute capsule redéfinit automatiquement
   l’unité. Conserver la convention existante si elle est cohérente.
3. Obtenir la pose du parent au même temps par le port public de présentation.
   Le parent racine utilise l’identité dans le repère de scène déjà établi.
4. Réutiliser les fonctions contenu/cadre pour composer les insets une seule fois.
5. Vérifier enfant, parent tourné, deux parents imbriqués, pivot décentré et
   insets asymétriques. Contrôler que la projection inverse rend le même auteur.

**Sortie exigée :** tests numériques des conversions, absence de perte de repère,
aucun changement du rendu ou des callbacks de l’interface de trajectoire.

### Étape D — corriger la rotation dans le traitement Decor commun

1. Adapter `previewFrame` pour fournir une modification auteur à partir de la
   base immuable et de la transformation parent/local. N’utiliser ni la preview
   précédente ni une frame de contrôle décomposée comme nouvelle base auteur.
2. Réordonner `onDecorChange` pour résoudre une seule fois le candidat effectif
   et les projections requises. Une fonction existante complétée ou extraite
   du bridge reste dans ce propriétaire ; ne pas construire un service parallèle.
3. Pour la tangente, point, progression, offset et ancre appartiennent au même
   contexte. Geler l’ancre pendant la rotation et dériver la translation de
   compensation nécessaire ; ne pas recalculer la tangente à partir de cette compensation.
4. Arrondir l’angle de commande une fois. Recalculer l’offset auteur par la
   conversion inverse adéquate, puis produire la pose utile et la preview.
5. Faire consommer le résultat accepté à `toSnapshotPatches`, au composant de
   présentation et au store. Vérifier les contrôles dès chaque mouvement.
6. Au pointerup, la preview finale peut répéter le delta final : elle doit être
   idempotente. Le commit consomme son résultat auteur sans réappliquer le delta.
7. Vérifier Échap et pointercancel : restaurer ensemble l’édition et les
   projections, sans écrire une opération inverse dans le document.

**Sortie exigée :** rotation correcte à la racine et dans la capsule tournée,
avant/après relâchement ; tests trajectoire de référence inchangés et passants.
Une régression de trajet interdit de passer à l’étape suivante.

### Étape E — fermer commit, reconstruction et reprise de présentation

1. `commitMotionDrop` utilise le candidat auteur accepté. Un KF pose exact
   modifie sa cible sans ajout de KF ; une pose interpolée ou un KF décor promu
   conserve le chemin de matérialisation et de découpage existant.
2. La copie de Decor partagé passe toujours par les commandes existantes.
   Les autres références gardent leurs valeurs. `path` reste propre au segment entrant.
3. Auditer la sortie Builder : expliquer le rôle de chaque canal avant toute
   modification. Les offsets auteur ne deviennent pas des angles monde persistés.
4. Vérifier que bind, seek et résultat adopté concernent la scène et l’instance
   encore courantes. Réutiliser les gardes de révision et les références existantes.
5. Identifier le rendez-vous de présentation qui peut remplacer le candidat
   temporaire. Ni un bind initial, ni une lecture prématurée de snapshot ne suffisent.
6. Observer le refresh réel après publication et un resize volontaire. La
   cohérence doit rester vraie après le rendu suivant ; ne pas conclure au seul
   premier `SEEK_APPLIED`. Ne pas faire de deuxième seek pour cacher un saut.
7. Vérifier sélection seule, Play/Pause/Stop, Undo/Redo et changement de scène.
   Une opération UI ou un transport sans changement de document conserve l’instance.

**Sortie exigée :** continuité document/candidat/rendu/CS sur le cycle complet,
aucune mutation de compensation déclenchée par un refresh.

### Étape F — renforcer le couplage des autres entrées sans casser la trajectoire

Ne commencer qu’après les portes C, D et E. Préserver l’interface actuelle.

1. Palette : faire consommer le traitement commun aux valeurs modifiées et
   relire les contrôles depuis ce candidat sans réémettre `onDecorChange`.
   Vérifier couleur, bordure, padding, taille, pivot et valeurs héritées.
2. Trajectoire : conserver le dessin pendant le drag, le calcul du médian, les
   ancres, la sélection, les ghosts, les priorités de hit-test et le reset.
   Conserver `onPathChange` comme notification de fin, une fois au relâchement.
3. Si nécessaire pour alimenter immédiatement le candidat Decor, étendre la
   même interface `MotionOverlayCallbacks` par une notification de preview et
   d’abandon du brouillon vers le bridge existant. Ce sont des callbacks locaux
   d’outil à concevoir dans cette interface, pas de nouveaux events CodPlay.
   La notification de fin existante garde son sens et son nombre d’appels.
4. Le bridge admet le path brouillon dans le registre existant, cible le bon
   Decor entrant et utilise la résolution commune au temps courant. L’aperçu
   de l’item passe par les mêmes fonctions géométriques et le même snapshot
   que le reste de l’édition ; aucun second moteur de trajectoire n’est ajouté.
5. Un `draftControl` local peut rester une donnée transitoire du pointeur si
   nécessaire au geste. Il ne devient ni un autre décor effectif ni une seconde
   autorité de projection. Supprimer seulement les calculs réellement redondants.
6. Étudier les champs hors style avec les ports natifs disponibles. Ne pas
   déclarer la synchronisation globale complète si une propriété affichée ne
   se projette qu’à la fin ; nommer exactement la capacité manquante et arrêter
   cette sous-partie avant de concevoir un contournement.

**Sortie exigée :** interface trajectoire de référence conservée ; synchronisation
commune immédiate et sans boucle pour chaque famille de champs couverte.

### Étape G — validation transversale et consolidation

Exécuter les sections 8 et 9. Consolider les specs uniquement pour les comportements
effectivement vérifiés. Retirer traces, scripts et helpers provisoires inutiles.
Supprimer les branches remplacées plutôt que conserver deux voies activables.
Ne pas supprimer des modifications antérieures hors périmètre.

## 6. Invariants de non-régression de l’interface de trajectoire

| Référence à préserver | Vérification obligatoire |
|---|---|
| Courbe et poignée actualisées pendant le drag | Tester avant pointerup ; ne pas reporter le dessin à la notification de fin |
| Médian visuel sur la courbe à 50 % de traversée | Garder `motionPathPointAtProgress` et la même préparation ACE |
| Une seule notification de fin | Test existant : zéro `onPathChange` pendant le drag, un au relâchement ; les éventuelles notifications de preview sont distinctes |
| Mouvement de l’item depuis le body CS | Aucune surface de déplacement concurrente ajoutée à l’overlay |
| Contrôle trajectoire au-dessus du CS | Hit-test, `data-editor-overlay`, absence de désélection parasite |
| Bouton tangent | Icône, visibilité sur chemin explicite, état et persistance sur le KF cible |
| Reset droit | Chemin explicite retiré par la commande existante, pas de nouvelle sentinelle documentaire |
| Ghosts et segments actifs/inactifs | Identités KF valides, clics, couleurs/distances, visibilité, chemin initial non dupliqué |
| Insertion d’un waypoint | Découpage existant, continuité du raccord et maintien des deux arcs |
| Visites et chargement avec les mêmes IDs | Aucun cache historique de pose ou path réutilisé comme autorité |
| Lecture | Suspension pendant Play et restauration des contrôles en édition |
| Persistance et historique | Path, option tangentielle et pose identiques après Undo/Redo et rechargement |

Ne pas supprimer, affaiblir ou réécrire les attentes de ces tests pour accepter
un résultat de la nouvelle architecture. Si une attente doit évoluer pour une
exigence explicitement nouvelle, conserver son invariant utilisateur et ajouter
le test de la nouvelle frontière ; expliquer ce changement dans la revue.

## 7. Fixtures et résultats attendus

Chaque test possède ses valeurs et sa scène. Réutiliser les constructeurs de
fixtures des fichiers de tests concernés ; ils ne doivent lire ni démo ni SQLite
utilisateur. Les heures et amplitudes ci-dessous donnent un jeu propre à établir.

| Fixture | Construction minimale | Contrôle principal |
|---|---|---|
| R0 | Un item, deux KFs à 0 et 5 s, sans path, offset 20°, dimensions 20 × 12 cqw | Rotation finale entière, sens, wrap et commit sans matérialisation supplémentaire sur KF exact |
| R1 | Trois KFs pose à 0, 2 et 5 s ; arcs entrants explicites, offsets distincts dont une valeur fractionnaire | Rotation avec tangente au KF exact et entre KFs, conservation du path et de l’ancre |
| R2 | R1 avec un KF décor à 1,1 s, bordure animée, padding gauche/haut distincts | Horloges pose/décor indépendantes, insets et compensation sous pivot `(0,0)` puis `(0.5,0.5)` |
| R3 | R1 dans une capsule fixe à 30°, puis dans deux capsules à 30° et −15° | Aller/retour local/scène et absence de double rotation parentale |
| R4 | Parent animé et enfant avec trajectoire locale ; poses parent/enfant au même temps | Seek/Play cohérents ; aucune matrice de parent périmée après changement de temps |
| R5 | Deux items à chemins simultanés, dont un départ décalé à 1,5 s et des dimensions différentes | Une modification de rotation sur A ne modifie pas le Decor ou le path de B ; cycle rebuild/refresh observé |
| R6 | Décor partagé par deux références et édition entre KFs | Copy-on-write, cibles exactes et création sparse/pose conforme au type de geste |

Pour les transformations pures, ajouter un oracle numérique simple : à largeur
de scène 800 px, 1 cqw = 8 px à la frontière définie. Pour
`P = translate(80,40) × rotate(30°)`, le point local `(100,60)` devient environ
`(136.60254,141.96152)` ; la conversion inverse retrouve `(100,60)`.
Tester la fonction réelle de conversion sur cet attendu, sans recopier son
algorithme dans un helper de test.

Angles à couvrir : valeur fractionnaire initiale, deltas de 1°, 5° et 90°,
passage 179°/−180°, aller puis retour du pointeur, delta final répété. Les
valeurs auteur et affichées sont vérifiées selon leur rôle, jamais forcées à
être égales lorsque la tangente ou le parent les distinguent.

Seuils : égalité exacte pour cible, champs persistés non touchés, nombre de
transactions et KFs ; tolérance de comparaison angulaire `0,1°` modulo 360
pour la continuité d’une même pose, et écart maximal `0,6 px` CSS sur ancre/coins
projetés dans les scénarios couverts par la représentation actuelle. L’angle
commandé doit être entier. Conserver les bornes plus précises des tests de
raccord déjà existants ; ne pas les relâcher au seuil géométrique général.

## 8. Tests automatisés et commandes

Exécuter depuis `packages/editor`, jamais depuis la racine du dépôt.
N’ajouter des tests qu’aux frontières réellement modifiées et pour les fixtures
propres ci-dessus. Un test qui répète une formule sans appeler l’implémentation
ne valide pas la correction. Relire les nœuds remplacés après rebuild.

Premier groupe, géométrie et protection de l’interface :

```sh
npx vitest run tests/motion-editor/geometry.spec.ts tests/motion-editor/content-box.spec.ts tests/motion-editor/border-insets.spec.ts tests/motion-editor/overlay.spec.ts
```

Deuxième groupe, candidat, preview, commit et compilation :

```sh
npx vitest run tests/decor-editor-bridge-integration-v2.spec.ts tests/decor-editor-bridge-v2.spec.ts tests/item-presentation/item-component.spec.ts tests/builder-v2/motion-path.spec.ts tests/builder-v2/player-interpolation.spec.ts tests/builder-v2/decor-properties-stress.spec.ts
```

Troisième groupe, cycle d’instance et frontières associées :

```sh
npx vitest run tests/scene-player-bridge-v2.spec.ts tests/editor-player-command-facade-v2.spec.ts tests/scene-selection.spec.ts tests/sequence-editor/tree-reorder.spec.ts tests/app/persistence/sqlite-editor-scene-persistence.spec.ts
```

Avant clôture, après les changements ciblés et les vérifications navigateur :

```sh
npx tsc --noEmit -p tsconfig.json
npm run build
npx vitest run
```

Ne pas relancer les mêmes groupes sans nouvelle modification ou nouvelle
information. Une catégorie applicable en échec garde le travail ouvert ;
ne pas la masquer par un test isolé passant ou un résultat de build.

## 9. Validation MCP dans la véritable application

### 9.1 Connexion et contrôle du navigateur

1. Inspecter la configuration MCP locale et **tout l’inventaire vivant** des
   outils (noms et descriptions), puis comparer serveur configuré et outils
   exposés. Ne pas conclure à l’absence de navigateur depuis un simple filtre de noms.
2. Lister les onglets et sélectionner celui d’Editor. **Une instance, une page.**
   Ne pas créer une session, lancer un autre navigateur ni ouvrir un autre onglet.
   Une navigation/recharge nécessaire cible explicitement le handle existant.
3. Si le navigateur connecté vérifié est Safari Technology Preview, l’activer :
   `osascript -e 'tell application "/Applications/Safari Technology Preview.app" to activate'`.
   Utiliser la permission d’exécution nécessaire, puis sélectionner l’onglet par MCP.
4. Vérifier `document.visibilityState === 'visible'` et `document.hasFocus()`
   avant l’interaction. Si l’utilisateur reprend le focus pour écrire, réactiver
   et retenter ; ne pas lui demander de focaliser l’application, ne pas simuler
   ces valeurs ni contourner les verrous d’édition.
5. Si le serveur configuré n’expose aucun outil callable, garder la validation
   en attente. Ne pas utiliser une autre application comme équivalent.

### 9.2 Parcours et mesures

Pour R0 à R6, adapter les fixtures à l’application par son chemin documentaire
normal, sans patch direct du DOM player ni changement des données pour cacher
une erreur. Préserver et restaurer le contexte utilisateur.

1. Sélectionner le KF et son temps ; attendre le rendez-vous de présentation
   normal. Relever Decor auteur, pose publiée, rendu effectif, CS et ancre.
2. Effectuer un geste avec plusieurs mises à jour. Relever les mêmes valeurs
   **avant le relâchement** ; vérifier aussi les contrôles de décor concernés.
3. Relâcher. Vérifier le dernier candidat, la transaction, le nombre de KFs,
   le path et les propriétés non touchées.
4. Observer la présentation après rebuild, puis le refresh suivant, sans seek
   correcteur. Attendre les rendez-vous réels ; pas de délai dans l’implémentation.
5. Faire un resize réel et comparer de nouveau. Les valeurs persistées restent
   inchangées par la seule projection.
6. Seek ailleurs puis retour, Play/Pause/Stop et Stop répété, Undo/Redo,
   sauvegarde/rechargement. Refaire les contrôles après chaque frontière.
7. Rejouer les gestes de trajectoire de la section 6 avant/après le changement
   d’architecture ; comparer la courbe, le médian et les ghosts pendant le drag.

Vérifier indépendamment la pose publiée et le rendu visible : le CS aligné à une
valeur interne ne suffit pas si l’item DOM a changé ensuite. Les lectures DOM de
diagnostic ne deviennent pas des calculs de production.

Utiliser les gestes natifs si l’inventaire MCP les fournit. Des `PointerEvent`
envoyés aux handlers réels peuvent couvrir les calculs de preview/commit ; ils
ne certifient pas seuls la capture native du pointeur. Ne pas neutraliser
`setPointerCapture`, les règles de focus ou les handlers pour faire passer un test.
Signaler exactement une limite d’outil au lieu d’annoncer un drag physique vérifié.

### 9.3 Parcours croisés obligatoires

- Couleur pendant une pose tangentielle : couleur immédiatement visible,
  géométrie inchangée ; aucun saut au commit.
- Bordure/padding puis rotation, et rotation puis bordure/padding : même résultat
  auteur lorsque les intentions finales sont les mêmes et compatibles.
- Édition de trajectoire puis rotation : path identique après une rotation seule,
  contrôle de courbe toujours utilisable.
- Commit suivi immédiatement de Play, Stop puis Play, Seek avant fin d’un
  rebuild, Undo/Redo ou changement de scène avec un travail différé.
- Parent tourné et enfant sélectionné : mêmes coordonnées locales après
  rechargement, aucune rotation parentale recopiée dans l’offset enfant.
- Sélection, vitesse, zoom timeline et hauteur de région : pas de mutation
  documentaire induite ; respecter les préférences Editor hors Undo/Redo.

## 10. Points bloquants à traiter sans élargissement implicite

| Point à établir | Action attendue de l’agent |
|---|---|
| Première cause du saut après relâchement/refresh | Étape B obligatoire avant choix de correction ; ne pas confondre stack appelée et donnée fautive |
| Origine et unité du repère de capsule | Étape C avec oracle aller/retour ; aucune nouvelle convention de cqw par déduction |
| Représentation affine non supportée par le CS | Conserver les matrices de calcul ; isoler la limite et demander revue avant modification du composant partagé |
| Champ ou action sans projection native immédiate disponible | Décrire l’écart exact, son propriétaire et son acceptation manquante ; ne pas inventer une API runtime ou un rendu substitut |
| Résultat MCP ou drag natif non accessible | Travail de validation en attente avec limite précise ; pas de seconde session Safari |

Ces points n’autorisent ni une correction de CodPlay ni un contournement
Editor. Continuer seulement les étapes indépendantes déjà autorisées ; ne pas
présenter le couplage complet comme achevé tant qu’un cas requis reste ouvert.

## 11. Conditions de clôture et documents à consolider

Le travail n’est clos que si les trois résultats suivants sont réunis :

1. Rotation corrigée sur le cycle complet et dans les capsules requises.
2. Couplage décor/projection immédiat démontré pour les entrées couvertes,
   avec tous les écarts requis explicitement résolus ou le travail laissé ouvert.
3. Interface de trajectoire et contrats d’écriture sans régression, établis
   par tests ciblés, suite Editor et vérification MCP dans l’application.

Mettre à jour les specs d’intégration, de présentation et d’orientation dans
la même tâche, uniquement avec les règles et mécanismes vérifiés et leurs
références de preuve. L’interpolation de décor ne change que si sa frontière
est effectivement modifiée. Ne pas y copier les étapes de ce plan ou un journal
d’intervention. Aucun rapport/README supplémentaire n’est demandé.

Le [mémo Editor](./decisions-a-prendre.md) garde le statut et les acceptations
restantes. Quand le périmètre est entièrement vérifié, transférer les références
nécessaires aux specs, retirer ce plan et les notes de travail devenus inutiles,
et mettre à jour les liens entrants. Ne pas retirer ce plan s’il conserve une
décision acceptée non appliquée ou une validation obligatoire non réalisée.
