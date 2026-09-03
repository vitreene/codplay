# Diagnostic V2 — reprise après seek dans `test position`

**Date : 2026-09-02**  
**Portée :** verticale éditeur position/taille V2 uniquement.

Cette note conserve la cause et la preuve du premier bug d’usage observé dans
la démo « Test position + couleur ». Elle ne crée pas une API publique et ne
change pas le contrat CodPlay V2.

## Symptôme

Après une lecture, un seek arrière dans `sequence-editor`, puis une reprise et
un second seek/reprise, la progression affichée continue tandis que les items
peuvent reprendre une pose déjà observée. Le comportement est particulièrement
visible lorsque la durée écoulée après la reprise est la même que celle de la
reprise précédente.

## Cause

Le `scene-player-bridge` V2 reconstruit une instance lorsqu'il entre dans
`playing`. Il conserve `authorTimeMs` et demande ensuite à la nouvelle
instance un seek à ce temps. Une instance fraîche expose toutefois un horizon
runtime découvert à `0 ms` tant qu'aucune frame n'a avancé. La façade de
pilotage bornait la demande auteur sur cet horizon (`getProgress().durationMs`)
au lieu de la durée connue de l'`EditorScene`.

La demande auteur non nulle était donc ramenée à `0 ms` sans échec de commande.
Le player avançait ensuite normalement depuis zéro ; le temps et la pose
observée n'étaient plus le même rendez-vous auteur, donnant l'impression d'un
item figé.

## Correction V2

- `buildSceneDocV2` fournit la durée auteur déjà validée ;
- `scene-player-bridge` la transmet avec chaque binding d'instance ;
- `EditorPlayerCommandFacade` borne les seeks auteur sur cette durée, puis
  ajoute le `preRollMs` pour appeler l'instance V2 ;
- l'horizon découvert du runtime reste une information de transport et ne
  décide pas de la validité d'un seek auteur.

Le pipeline reste unique : `playheadMs` auteur → `SEEK` → façade de pilotage →
`instance.telco.seek()` → `SEEK_APPLIED`, puis lecture V2 par le même chemin de
matérialisation/résolution/présentation.

## Preuves

- test de façade : un seek à `1250 ms` reste à `1250 ms` après remplacement
  par une instance fraîche dont l'horizon initial vaut zéro ;
- test d'intégration DOM V2 : Play → seek arrière → reprise → second seek →
  reprise, avec `1500 ms` puis `1250 ms` observés après les mêmes frames et une
  pose distincte ;
- suite éditeur : 30 fichiers, 342 tests passés ;
- typecheck `packages/editor` passé ;
- build `@codplay/editor` passé.

La matrice navigateur complète, notamment Safari Technology Preview, reste ouverte conformément au
plan actif.

## Correction de contrat V2 — édition à un temps interpolé

La reproduction a établi que le cadre de sélection peut être visible alors que la tête de lecture
se trouve entre deux keyframes. La décision V2 apportée pendant la revue est la suivante :

- `isTemporary` signifie seulement qu'aucun décor persistant ne correspond encore à cet instant ;
  il ne rend pas la cible en lecture seule ;
- un geste de cadre ou une modification de palette est autorisé à tout temps et passe par la preview
  logique `instance.snapshot.set()` ; il ne modifie pas `EditorScene` tant qu'aucun décor n'existe ;
- la création d'un keyframe à cet instant crée alors le décor frais et y capture la valeur de preview,
  dans la transaction documentaire V2 ; c'est cet acte qui rend l'édition persistante ;
- une sélection d'un keyframe déjà existant conserve le chemin normal d'écriture de son décor.

Le comportement actuel diverge de cette décision à deux endroits (`previewFrame` et
`onDecorChange` refusent `target.isTemporary`). Retirer ces deux gardes ne suffit pas :
`snapshot.get()` exclut la preview active, donc le pont `sequence-editor` devra recevoir le candidat
accepté du pont `decor-editor` au moment de la création du keyframe. Cette extension est à traiter
comme un item V2 distinct ; aucun correctif de code n'est appliqué dans ce diagnostic.

## Reproduction visuelle dans Safari Technology Preview

Le serveur Vite a été ouvert dans Safari Technology Preview sur
`http://127.0.0.1:5174/`, puis le parcours a été repris depuis un chargement propre de la démo
« Test position + couleur » :

1. Un seek au milieu du segment affiche `2.5 s`. La sélection par un vrai `mousedown` sur Item A
   affiche immédiatement le cadre de sélection ; l'item est bien identifié et le cadre reprend le
   même rectangle.
2. Un déplacement du cadre ne change ni le style de l'item ni le cadre. La cause est directe :
   `previewFrame` retourne `null` dès que `target.isTemporary` est vrai.
3. Une modification de couleur dans la palette ne change pas l'item et produit le warning
   `[decorEditor bridge] édition ignorée — décor temporaire ...`. La cause est la seconde garde de
   `onDecorChange`.
4. Désélectionner sur le fond puis resélectionner Item A reproduit exactement le même blocage : ces
   gestes ne débloquent rien.
5. Un seek sur un keyframe réel (ou la sélection explicite d'un keyframe dans la timeline) rend la
   palette et le cadre éditables immédiatement. Le déblocage vient donc de la résolution de cible,
   pas de la succession désélection/résélection.

Un point de précision explique un déblocage parfois perçu comme aléatoire : la timeline ajoute une
marge de rendu de `6 px` et fonctionne à `80 px/s`. Le point visuel `x=414` correspond ainsi à
`2487.5 ms`, alors que l'affichage arrondi montre `2.5 s`. Un double-clic de création au point
`x=415` est, lui, arrondi à `2500 ms`. Après cette insertion, `resolveTarget` voit encore un temps
entre les keyframes tant que le temps auteur reste `2487.5 ms`; la sélection explicite du nouveau
keyframe ou un seek réellement aligné le fait alors passer dans le chemin éditable.

Cette preuve STP confirme donc deux écarts V2 distincts : l'interdiction actuelle d'éditer une
preview interpolée, et la résolution stricte en millisecondes entre le seek affiché et le keyframe
nouvellement créé. Aucun code n'a été modifié pendant ce parcours ; la capture visuelle est
`/private/tmp/editor-stp-between-selected.png`.

## Seek pendant une édition déjà ancrée

Sur le même parcours, une couleur modifiée au keyframe créé à `2500 ms` a été laissée en preview,
puis un seek à `3.8 s` a été exécuté avant l'inactivité de phase. Le retour à `2.5 s` retrouve la
couleur modifiée : le comportement actuel commit automatiquement cette phase au seek (`flushNow()`
sur l'événement `seek`). Cela caractérise le chemin d'un décor déjà persistant ; il ne tranche pas
le futur comportement d'une preview interpolée, puisque cette dernière est encore refusée avant de
pouvoir être testée. La décision V2 « autoriser l'édition à tout temps » reste donc à implémenter
et à tester avec ce même scénario avant de fixer la règle de conservation ou d'abandon au seek.

## Implémentation V2 engagée le 2026-09-02

Le point D1.10 du plan actif est maintenant raccordé :

- `isTemporary` n'est plus rejeté par `previewFrame` ni par `onDecorChange` ; cadre et palette
  écrivent une preview atomique par `snapshot.set()` sans commande documentaire ;
- `EditorCoordinationBridge.decorPreview` conserve le `DecorPatch` accepté avec son temps auteur,
  séparément de `snapshot.get()` ; il le rapproche du temps d'insertion dans une tolérance de `50 ms`,
  nécessaire pour le pas de timeline de `100 ms` ;
- `sequence-editor-bridge` donne priorité à ce candidat lors de `createNamedKeyframe`, omet le
  `decorId` partagé, remplit le décor frais dans la même transaction, efface la preview puis
  sélectionne le keyframe créé ;
- un candidat est réappliqué après un seek/rebuild lorsqu'on revient à son temps et est abandonné
  avec Échap, sans mutation de `EditorScene` avant la création du keyframe.

Preuves de non-régression réalisées : `342` tests éditeur existants passent, auxquels s'ajoutent
les tests V2 du registre de candidat, de la capture sans `snapshot.get()` et du bridge de timeline
(`345` tests au total), ainsi que le typecheck éditeur. Dans Safari Technology Preview, le parcours
réel `2487,5 ms → édition cadre + couleur → keyframe 2500 ms` crée un décor frais, le sélectionne,
et restitue le candidat après un seek hors du point puis retour ; aucun warning ni erreur nouveau
n'a été observé après le rechargement propre.

## Validation complémentaire après la correction

La validation ciblée finale confirme :

- `32` fichiers et `346` tests éditeur passent ; le typecheck et le build `@codplay/editor` passent ;
- le test d'intégration `decor-editor-bridge-integration-v2.spec.ts` vérifie le seek hors temps,
  l'effacement du snapshot périmé, la conservation du candidat, son retour et l'absence de mutation
  de `EditorScene` ;
- dans Safari Technology Preview, un geste de cadre et une couleur au temps interpolé sont visibles
  immédiatement ; le seek à `3,5 s` restitue la base interpolée, le retour à `2,5 s` restitue le
  candidat, et Échap l'abandonne sans créer de keyframe ;
- dans Safari Technology Preview, la création arrondie à `2,5 s` produit un décor `decor-kf-*`
  frais, sélectionne le keyframe et conserve le changement ; après un seek arrière, Play reprend et
  l'item évolue de nouveau avec le temps.

## Correction de capture au moment de la création du keyframe

La première implémentation ne persistait le décor frais que lorsqu'un candidat de preview était
présent. Elle ignorait donc le cas pourtant obligatoire où l'auteur ajoute un keyframe pendant une
interpolation sans modifier l'item : le nouveau keyframe partageait alors le décor voisin au lieu
de photographier l'état affiché. Elle remplaçait aussi entièrement le snapshot par le candidat,
ce qui pouvait perdre une propriété interpolée que le geste utilisateur n'avait pas touchée.

Le circuit V2 est maintenant explicite :

- `snapshot.get()` fournit toutes les propriétés CSS résolues et la pose structurée au temps du
  keyframe ; les propriétés de pose restent routées vers `Decor.offset` ;
- le candidat conservé par `EditorCoordinationBridge.decorPreview`, s'il existe, est fusionné
  par-dessus ce snapshot, propriété par propriété ;
- la création n'est enrichie que si l'état final diverge de la cascade, avec un décor frais et un
  `setDecor` dans la même transaction ;
- si le double-clic a demandé un seek encore asynchrone, `sequence-editor-bridge` attend
  `SEEK_APPLIED` et vérifie la progression auteur ainsi que la cohérence temporelle du snapshot
  avant de photographier l'état.

Les tests V2 couvrent désormais la capture sans preview, la fusion preview + interpolation et le
cas snapshot périmé. Dans Safari Technology Preview, le même parcours « Test position + couleur »
a été repris sans aucune intervention sur Item A : l'ajout au milieu à `2,5 s` attend bien le seek
appliqué, crée le troisième keyframe, le sélectionne et restitue la couleur interpolée
`oklch(0.6 0.24 322.5)`, la rotation `7,5°` et la pose intermédiaire. La console ne signale ni
erreur ni warning ; la capture est conservée dans
`/private/tmp/editor-kf-interpolation-capture-stp-selected.png`.

La matrice globale reste ouverte pour les combinaisons hors de ce cas (S2, parcours complet de
resize/lifecycle et extensions de structure) avant de marquer D1/R1 stabilisés.

## Régression Play après keyframe — correction du 2026-09-03

Une régression distincte apparaissait après l'ajout d'un keyframe, puis un rewind et un Play : le
contrôleur passait bien à `playing`, mais l'instance restait `ready` ou reprenait sans avancer
visiblement. Le dernier handoff avait supprimé le seek systématique avant Play pour éviter une
course avec les seeks asynchrones ; cette suppression masquait un décalage propre au contrat V2.

La cause précise est la suivante : `EditorPlayerCommandFacade` expose le temps auteur en retranchant
le `preRollMs`, alors que `telco.rewind()` du runtime revient à `playerTime=0`. Après un rewind, les
deux lectures annoncent donc `timelineMs=0`, bien que la position runtime attendue pour le début
auteur soit `preRollMs`. La comparaison sur le seul temps auteur concluait à tort que la pose était
déjà alignée et lançait Play depuis le mauvais repère.

Le bridge `scene-player` conserve désormais le `preRollMs` actif, attend tout seek encore engagé,
compare `progress.playerTimeMs` à `authorTimeMs + preRollMs`, puis effectue un seek de réparation
uniquement si ces coordonnées diffèrent. Le Play simple conserve toujours la même instance ; un
rebuild n'est déclenché que par une scène effectivement commitée. Les callbacks de reprise derrière
un rebuild sont identifiés par requête et invalidés lorsqu'une demande plus récente arrive.

La régression est couverte par le parcours d'intégration réel des bridges `sequence-editor`/
`decor-editor` : ajout d'un keyframe, Stop, Play immédiat, rewind pendant la lecture, puis nouvelle
reprise avec avancement de l'horloge. Les 36 fichiers et 386 tests de l'éditeur passent, ainsi que
le typecheck et le build de l'éditeur ; les 87 fichiers et 547 tests CodPlay passent également.
La vérification native complète dans Safari Technology Preview reste une étape P7 à exécuter sur
le serveur existant `127.0.0.1:5174`, sans lancer de serveur supplémentaire.

## Erreur de reconstruction V2 — tween sans source (2026-09-03)

La vérification MCP dans l'onglet existant de **Safari Technology Preview** a reproduit l'erreur
que les tests de reprise Play ne couvraient pas :

1. rechargement propre sur `http://127.0.0.1:5174/` ;
2. chargement de la scène, création d'un item texte, ajout d'un keyframe intermédiaire ;
3. dans le panneau « Typo », ajout d'une propriété `color` absente des décors précédents ;
4. sélection/seek sur ce keyframe : la console signalait
   `Resolve requires an explicit or materialized tween from.` depuis
   `scene-player-bridge` → `reconstructPlayerScene` → `resolveStyleValue`.

La cause est localisée dans `buildInterpolationActions` : une propriété uniquement présente à la
destination passait par `isInterpolableStylePair(undefined, value)` et devenait
`{to: value, duration, ease}`. Son action démarrait au début du segment, alors qu'aucune valeur
source n'existait dans l'état logique initial ; V2 refusait à raison de matérialiser ce tween.

Le Builder sépare désormais les deux cas :

- paire source/destination complète : tween explicite `{from, to, duration, ease}` ;
- propriété destination-only : action de style directe, séparée, à
  `destination.timeMs + preRollMs`.

Aucun défaut CSS n'est inventé et le runtime n'est pas assoupli. Le parcours MCP après rechargement
produit une instance, conserve la couleur au keyframe, puis reprend Play après retour au début sans
erreur console ; la progression observée n'est plus bloquée. La couverture automatisée ajoute le
Builder, l'initialisation CodPlay et la matérialisation avant/après le keyframe.
