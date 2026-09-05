# Note de faisabilité — `story.reset()`

## Statut

> Type : note d’étude, non contractuelle
> Date : 2026-09-05
> Version CodPlay : V2 foundation

## Définition retenue pour l’étude

La notation `story.reset()` désigne une capacité de scène, déclenchée par un
eventime dont le contenu ne porte pas de cible. Selon le contrat `CompiledEventime`,
il contient son nom, son temps relatif, sa portée éventuelle, ses données et ses
enfants. Il est intercepté par les règles `listen` des stories, puis le
matériau des persos évalue leurs actions portant ce nom. La story qui traite
cette capacité est la portée du reset.

Ce n’est pas une méthode exposée par `CodPlayInstance`. Si un hôte injecte
l’eventime par `instance.events.emit(eventime, target)`, le `target` est une
adresse d’injection séparée du contenu de l’eventime ; il ne devient pas une
cible du reset. Lorsque l’événement est traité, la capacité ajoute un fait
runtime au temps logique courant et projette immédiatement un nouvel état de la
story à partir de son état initial compilé.

Ce n’est pas :

- un `telco.rewind()` ;
- un déplacement de l’horloge ;
- une pause ou une reprise du player ;
- un effacement ou une réécriture du journal ;
- un `tween:stop` ;
- un unmount des nœuds auteur ;
- une détection de visibilité par le DOM.

Le reset doit notamment supprimer la présentation temporaire d’un overlay en
cours. L’overlay est une ressource de présentation ; il ne constitue pas
l’état logique de la story.

## Appuis déjà présents dans CodPlay

| Brique existante | Ce qu’elle apporte | Limite actuelle |
| --- | --- | --- |
| `RuntimeTrackJournal` | append ordonné, révision, temps d’application et conservation des faits | aucun marqueur de reset ni frontière de projection |
| `materializeScene()` | reconstruit depuis l’état initial compilé et le journal | rejoue actuellement toute l’histoire pertinente jusqu’au temps demandé |
| `RuntimeStateStore` | sépare état de scène et états de story | aucune opération de restauration d’une story à son initial |
| `RuntimePlayer.emitEventime()` / `emit()` | injection dans le journal partagé et reconstruction normale ; l’eventime reste distinct de son adresse d’injection | aucune capacité de reset branchée sur un événement |
| `HtmlMotionSystem` / host | efface les ressources temporaires et reconstruit un graphe | pas d’invalidation sémantique par reset de story |
| circuit d’événements de scène | reçoit déjà les événements et les route vers leur story | aucune capacité de reset branchée sur un événement |

La faisabilité logique est donc bonne : le journal et la reconstruction sont
déjà les bons points d’ancrage. La feature n’est pas une correction de démo,
mais une extension coordonnée du contrat journal → projection → présentation
→ capacité de scène.

Il ne faut pas ajouter pour cela un cycle de vie `active/inactive` ou une
génération de story. Cette piste confondrait le rôle de CodPlay avec celui de
la couche de présentation ; Sighty est le niveau adapté pour orchestrer la
présentation et le cycle de vie d’une démo. Un guard `active/inactive` peut
être étudié séparément, mais il n’est pas retenu ici car il risquerait de
filtrer des événements attendus par une story ou un perso.

## Projection attendue

Pour un reset produit à `R` lorsque la story `S` intercepte l’événement,
l’évaluation à un temps `T` doit respecter la règle suivante. `S` est déduite
de l’interception ; elle n’est pas une cible portée par l’événement.

1. si `T < R`, la reconstruction reste celle de l’histoire antérieure au
   reset ;
2. si `T >= R`, la story `S` repart de `S.state` et de ses persos initiaux ;
3. seuls les faits applicables à `S` après la frontière `R` sont ensuite
   projetés, dans l’ordre journalisé ;
4. les autres stories et l’état de scène ne sont pas implicitement remis à
   zéro ;
5. les faits antérieurs restent consultables et rejouables : ils ne sont pas
   supprimés.

Les événements futurs ne sont ni supprimés ni invalidés par ce reset. Ils
continuent de passer dans le circuit normal d’interception. La sortie de la
story peut être masquée par le carousel ; ce masquage ne devient pas un guard
qui empêcherait les stories ou les persos de recevoir leurs événements.

La règle d’inclusion des événements de scène qui se propagent à une story doit
être fixée dans le contrat : la proposition la plus cohérente est de ne
projeter après `R` que les contributions de scène postérieures à `R`, sans
réinitialiser pour autant l’état propre de la scène.

L’ordre des faits au même temps doit également être normatif. Le reset doit
être ordonné avec les événements compilés et les événements runtime selon le
mécanisme de séquence existant ; aucun tri ad hoc propre à la démo ne doit être
introduit.

## Invalidation de présentation

Le reset est une discontinuité logique, pas une transition. Après sa
projection :

1. les ressources overlay appartenant à `S` sont retirées ;
2. les transformations locales temporaires de `S` sont retirées ;
3. les frontières et le graphe motion qui reposent sur l’état antérieur de `S`
   sont invalidés ;
4. l’état initial matérialisé est présenté immédiatement, sans trajet entre
   l’ancienne pose et la nouvelle ;
5. un `move` ultérieur peut être découvert et capturé par le chemin normal
   déjà prévu pour les moves live.

Cette invalidation doit être signalée par le runtime avec la portée logique de
la story qui a intercepté l’événement. Elle ne doit pas parcourir le DOM pour
deviner quel overlay supprimer. Les identifiants qualifiés des items et l’état
du host sont les informations disponibles ; le parent DOM ne doit pas devenir
une source de vérité.

Dans l’implémentation actuelle, le host possède des ressources globales à
l’instance. La faisabilité est conditionnelle à une invalidation ciblée par
story, ou à une preuve que l’instance ne peut présenter qu’une story à la fois.
Effacer globalement toutes les ressources serait acceptable pour la démo
`position` à une story, mais ne constitue pas le contrat général de
`story.reset()`.

## Capture et actions en cours

Le reset ne supprime pas les événements futurs et ne change pas leur circuit
d’interception. Une capture ouverte ou une émission différée suit donc le
comportement normal de la story et du perso concernés ; si la démo sortante est
masquée, sa présentation reste masquée. Toute règle de guard ou de suppression
des événements devra faire l’objet d’une feature distincte et d’un contrat
explicite.

## Capacité de scène déclenchée par événement

Le nom fonctionnel demandé reste `story.reset()`, mais il décrit le résultat
de la capacité, pas une méthode de façade. Un eventime entrant, sans cible dans
son contenu, est traité par le circuit normal de la scène : la règle `listen`
de story est sélectionnée par nom exact, puis les actions des persos sont
évaluées. La capacité est appliquée par ce circuit, sans ajouter de ciblage au
payload. L’émission peut donc provenir du clavier ou d’un strap existant, mais
elle ne doit pas appeler directement le player, le DOM ou une méthode
`instance.story(...).reset()`.

La capacité utilise la même instance, le même player et le même journal que
les autres événements. Elle ne crée aucun second circuit événementiel.

## Patron d’instances préconstruites

Le patron de référence pour les démos répétitives, notamment les séries de
questions, est de dupliquer les instances plutôt que de regrouper toutes les
démos dans une seule story `main` :

- chaque démo possède une instance, une scène préconstruite, un player et un
  journal propres ;
- le carousel présente l’instance courante sans devenir le propriétaire de son
  état CodPlay ;
- un événement de reset est résolu dans l’instance de la démo courante et ne
  vise pas une story globale `main` ;
- la reconstruction de cette instance reste déterministe : `play(t)` et
  `seek(t)` passent par la même scène préconstruite et le même journal ;
- aucune interaction avec une autre instance ne peut laisser une projection
  motion ou une action dans la démo courante.

La mesure de la scène `position` montre l’assemblage actuel, avec six cellules
dans une même instance. Cet assemblage ne doit pas être utilisé comme
justification pour élargir la portée de `story.reset()` : le mapping entre une
démo du carousel et son instance doit être explicite dans la conception de la
démonstration.

## Application au carousel de la démo `position`

`story.reset()` concerne uniquement la story de démo actuellement active dans
le carousel. Il intervient avant l’action utilisateur de navigation
`précédent`, `suivant` ou `Entrée` :

1. l’action clavier identifie la story de démo courante ;
2. cette story intercepte l’événement et projette son reset ;
3. seulement ensuite, le carousel poursuit l’action de navigation et produit
   la sortie de la story courante puis l’entrée de la suivante.

L’espace, qui agit sur l’animation de la story courante, ne déclenche pas ce
reset de navigation.

Le reset de la story de démo courante ne doit pas être redirigé vers la story
`main`. Le bouton « Recharger la scène » de la telco est une opération
distincte de reload de scène : il reste inchangé, n’est pas raccordé à cette
feature et ne doit pas être remplacé par `story.reset()`.

Le circuit de scène ne doit pas ajouter de cible à l’événement de navigation.
L’instance de la démo courante et ses stories/persos l’interceptent selon le
circuit événementiel existant. La story globale `main` et le reload de scène de
la telco restent hors de cette opération.

L’effet attendu du reset de navigation est : temps logique inchangé, état
initial de la story courante, overlay et transformations temporaires de cette
story supprimés, nœuds auteur conservés, puis navigation normale vers la story
suivante ou précédente.

## Conclusion de faisabilité

La feature est applicable sans contournement si elle est traitée comme une
frontière de projection persistante dans le journal, avec une invalidation
motion sémantique et une capacité de scène déclenchée par événement. Elle
n’est pas applicable par le seul appel de `refresh()`, par
`resetSequenceForReplay()`, par un nettoyage DOM ou par un remount de la démo.
Ces voies changeraient respectivement une présentation, toute la séquence, le
mauvais niveau de vérité ou le cycle de vie extérieur au contrat demandé.
