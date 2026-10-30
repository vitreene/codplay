# Trajectoire affichée et lecture effective

**Date :** 2026-10-29  
**État :** cause historique identifiée et restauration vérifiée. Le
comportement rétabli est décrit dans la
[spécification motion CodPlay](../../../codplay/specs/motion-frame-v2-spec.md).
Le parcours de session expliquant
les essais utilisateur réussis après l'introduction du défaut reste inconnu.

## Circuit conservé

Le décor du KF pose cible conserve `Decor.path`. Le builder vérifie le SVG,
puis émet `move.transition.path` avec le parent existant, la durée du segment
et son easing. Sur la scène observée, le segment va de 0 à 5 000 ms auteur ;
le pré-roll ajoute 300 ms aux temps runtime. L'action contient également les
tweens numériques de translation et de rotation. Le chemin est encore présent
sous forme de segments préparés dans l'état compilé/runtime.

Le tracé auteur et la lecture utilisent donc encore leurs circuits établis.
La présence du tracé ne prouve cependant pas son application à l'item.

## Divergence avant restauration

Sur la scène restaurée, l'item interpole sa translation suivant la droite
entre les deux poses et sa rotation jusqu'à 46°. La présentation motion
(`instance.presentation.get()`) reste absente pendant cette lecture. La
courbe stockée est un arc ; elle n'est donc pas appliquée au déplacement.

La création d'instance Editor est suivie d'un seek au temps auteur conservé,
ici 0 ms, soit 300 ms runtime. Les appels observés dans les copies de l'app
sont `seek(0 auteur)`, `play`, puis `pause`. Le simple choix de l'item n'ajoute
pas de snapshot de preview à cette séquence.

Un contrôle isolé utilisant la scène compilée et le même runtime présente une
courbe lorsqu'il joue depuis le temps runtime 0 sans seek initial. Après un
seek initial à 300 ms, il conserve les tweens CSS mais ne présente plus la
trajectoire. L'éditeur effectue lui-même ce seek au chargement : la séquence
fautive ne requiert aucun déplacement manuel de la tête avant Play.

La présentation finale de seek est transformée en `phase: 'geometry-capture'`
par `RuntimePlayerPresentation.present()`. Cette phase écarte les occurrences
motion et fait quitter `MotionMaterializer` avant leur présentation. Play
reprend ensuite après cette frontière déjà traitée, sans préparer à nouveau
le même mouvement.

## Introduction du défaut et contrôle historique

La comparaison du même test autonome
`keeps path presentation after the initial seek, playback, Stop and resume`
conserve l'éditeur et sa fixture, en changeant seulement le runtime CodPlay :

| Runtime | Résultat |
| --- | --- |
| `569ad4ac`, parent de `333b5327` | Réussite |
| `333b5327`, 6 octobre 2026 à 11:17 +02:00 | Échec : présentation absente après le seek initial |
| `64e92551`, 27 octobre, avant la reconstruction de l'éditeur | Même échec |
| HEAD `b86e11f6`, avant correction | Même échec |
| Copie HEAD avec le correctif isolé | Réussite |

La datation ne repose donc plus seulement sur `git blame`. Le test CodPlay
qui existait déjà dans ces deux révisions,
`routes instance telco seek through the HTML runner so FLIP moves are prepared`
(`tests/facade/facade.spec.ts`), réussit également sur `569ad4ac` et échoue sur
`333b5327` : l'overlay attendu n'est plus préparé. Cette non-régression aurait
dû empêcher d'accepter le changement. Git ne prouve pas quels tests ont
effectivement été exécutés lors du commit.

Le commit `333b5327` ajoute les méthodes HTML focus/blur et assimile la
présentation de Seek à une capture géométrique pour en supprimer les effets.
La suppression est trop large : elle coupe aussi le mouvement. Les nouveaux
tests vérifient focus/blur, sans leur coexistence avec la présentation motion.
Le seul fichier de code CodPlay modifié entre le 27 octobre et HEAD est
`runtime/motion/html-pose.ts`, dans `df51bda4`, pour la capture affine avec
bordure ; il ne crée pas cette suppression de préparation.

Ce résultat date le défaut précis reproduit. Il ne reconstitue pas la session
où l'utilisateur a vu la courbe fonctionner après le 6 octobre. Une instance
dont le graphe était déjà préparé peut masquer le défaut ; ce comportement a
été observé, mais son rôle dans cette session reste une hypothèse. Les
validations récentes de l'éditeur n'ont pas suffisamment contrôlé la position
sur une courbe après un chargement à froid. L'utilisateur reproduit également
la rupture des trajectoires par Seek dans la démo flip-stress le 29 octobre.
Il confirme que les trajectoires fonctionnaient à sa reprise d'éditeur en
début de semaine. Le défaut historique de Seek est prouvé, mais ne suffit pas
à attribuer la rupture récente à ce commit : le changement de parcours ou
d'état entre ces observations reste à établir. Une instance déjà préparée ne
doit pas être présentée comme l'explication de sa session sans cette preuve.

## Comparaison et limites

Trois copies temporaires de l'interface, alimentées par la même scène et le
même code CodPlay actuel, reproduisent la lecture rectiligne après chargement :
`64e92551` (React), `8bf730b9` (Remix avant SQLite) et `b86e11f6` (version
actuelle). Le contrôle historique ci-dessus date séparément la cause du défaut
de Seek ; aucune comparaison ne reconstitue l'état exact où l'utilisateur a
vu la trajectoire fonctionner en début de semaine.

La restauration reprend exactement le raccord antérieur dans
`RuntimePlayerPresentation.present()`: collecte des occurrences selon
`materialization.phase` et transmission du contexte original. Le contexte
partagé transporte `componentPhase`; `HtmlComponentMaterializer` omet ses
méthodes si cette phase vaut `seek` ou si la présentation est explicitement
`geometry-capture`. Le parseur et les sémantiques de `focus`/`blur` ne changent
pas. Aucun appel à `prepareGeometryCapture()` n'a été ajouté : les seeks répétés
restituent la même pose DOM dans le navigateur.

Le test `motion-path.spec.ts` exige désormais le segment et sa progression après
Seek, puis après Seek initial → Play. Les suites CodPlay ciblées passent
(12 fichiers, 142 tests), dont rollback, resize, reset, multi-racines et
méthodes HTML. Dans Safari, l'item de la scène persistée suit l'arc en Play à
1,2 s et au Seek à 2,2 s ; un détour par 4,2 s puis retour à 2,2 s restitue la
même matrice. Stop retourne tête, objet et CS à 0. La scène SQLite reste à la
révision 16.

Le cas à trois keyframes qui signalait `0px` dans jsdom a aussi été rejoué dans
Safari avec les ponts Scene et Decor réels, sur une scène temporaire non
persistée : au dernier KF, item et CS sont à `480px, 480px`, rotation `90deg`.
Dans jsdom, `getComputedStyle()` ne convertit pas `translate(...) rotate(...)`
en matrice, que le parseur de pose accepte ; le test vérifie donc le segment et
le style auteur, tandis que la coordonnée calculée est vérifiée dans le
navigateur. Le test `keeps the complete ghost chain after creating successive
displaced keyframes and playing to the end` reste un échec préexistant
distinct : il attend un `PresentationFrame` à la fin d'une scène sans path. Je
l'ai reproduit avec et sans la condition de re-seek à la durée ; il ne constitue
donc pas une régression de ce changement et ne vérifie pas l'alignement de
l'item au CS.

Le runtime CodPlay reste l'unique résolveur ; l'éditeur n'ajoute pas de lecteur
de trajectoire parallèle. `blur` n'est pas modifié et restera un fix séparé,
limité aux inputs si un défaut concret le justifie.

## Pose live conservée après la fin naturelle

Sur la scène de tangente, la fin naturelle à `5 s` laissait l'élément dans sa
dernière pose live du chemin (`46°`). Le CS affichait la pose terminale
`PresentationFrame` (`-15,483°`). Un Seek depuis `4,2 s` vers `5 s` réappliquait
la frame terminale et remettait l'élément et le CS d'accord. Le CS suivait donc
la frame prévue ; c'est le style live de l'élément qui n'avait pas été rétabli.

Le handoff `EditorCoordinationBridge.requestPause()` appelait directement
`finishPause()` quand le temps de pause était déjà exactement à la durée. Il
ne réappliquait la frame via Seek que lorsque le clamp changeait le temps (par
exemple pendant un outro de capsule). Il re-seek désormais la même durée avant
la réconciliation et la réapparition du CS. Le test d'intégration
`scene-player-bridge-v2.spec.ts` fait avancer une vraie instance CodPlay jusqu'à
la durée exacte et vérifie la séquence pause → Seek terminal ; il échoue si le
re-seek terminal est retiré.

Le retest Safari MCP du 29 octobre a réfuté le re-seek identique comme
correction suffisante. Après rechargement, la page était visible et au premier
plan. Play réel de 0 à 5 s a fini avec le ghost visible, l’item conservant
`translate(461.701031px, 157.016969px) rotate(46deg)` et le CS affichant
`rotate(-15.482944deg)`. Le screenshot et le DOM reproduisent le défaut.
L’utilisateur précise que les ghosts sont faux ; ils ne servent donc pas
d’oracle pour cette correction.

Un seek auteur distinct vers 4,2 s puis vers 5 s replace le rendu sur la pose
terminale exposée au CS. Le seek identique à 5 s effectué par le handoff naturel
n’y parvenait pas : il ne changeait pas le temps déjà présenté. Le handoff Editor
seek désormais à `durée − 2 ms`, puis revient à la durée exacte avant la
réconciliation et le retour du CS. Safari MCP a confirmé l’accord item/CS après
Play naturel de 0 à 5 s, Seek de 4,2 à 5 s et Stop de 5 à 0. Après rechargement,
les deux KF auteur restent à 0 et 5 s ; aucun Undo/Redo ne reste actif. Le
retour de la pose et le test ciblé sont vérifiés. Les ghosts sont faux selon
l’utilisateur et n’ont pas servi d’oracle. Le test complet conserve un échec
préexistant distinct sans path (`PresentationFrame` absent au terme) ; les 11
autres tests passent. TypeScript, build et `git diff --check` passent.
