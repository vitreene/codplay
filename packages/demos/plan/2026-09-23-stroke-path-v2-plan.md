# Portage V2 de Stroke Path

## Statut

- Décision de portée : **Fixe**, fixture expérimentale explicitement non normative.
- Implémentation : **En cours** jusqu'à validation du parcours navigateur réel.
- Décision utilisateur du 2026-09-23 : cette démo pousse CodPlay à ses limites ;
  des choix locaux contestables sont acceptés s'ils sont signalés comme
  expérimentaux et ne deviennent pas des contrats V2.

## Objectif

Porter `packages/demos/src/v1/codplay/stroke-path-demo.ts` dans le registre V2
en conservant le geste dessiné, les tracés accumulés, la persistance,
la restauration et le bouton d'effacement.

## Chemin runtime conservé

- `pointerdown` démarre une capture V2 sur le vrai perso matérialisé ; les
  `pointermove`, `pointerup` et `pointercancel` passent par l'adaptateur et le
  contrôleur de capture du player.
- L'événement de démarrage est traité avant l'ouverture de la session ; le
  composant local mesure alors son SVG attaché et l'initialiseur de capture
  retient ce repère pour toute la durée du geste.
- Chaque `trackCommand` retourne l'action live déclarée. Le player la projette
  sur le composant de la démo via son chemin `updateLive()` normal.
- `stroke:captured` passe par le dispatcher et un strap de story qui simplifie
  les points, met à jour l'état de story et émet le snapshot des traits.
- Le bouton Effacer passe par le bridge DOM `Perso.emit`, puis par le strap de
  story et le strap de scène qui nettoie le stockage.
- Le chargement restaure les traits avec un eventime V2 ciblé sur la story.
- Le layout partagé conserve la page, la télécommande, le journal et le cycle
  de vie de l'instance. Son hôte reste inerte jusqu'au premier Play selon le
  [contrat du layout V2](../specs/v2-demo-layout-spec.md).

## Exception locale, non normative

Le composant enregistré uniquement par cette démo détient le groupe SVG de
traits et crée/supprime ses enfants `<path>` directement. Il mesure aussi sa
propre racine au départ du geste et au redimensionnement afin de convertir les
coordonnées écran en coordonnées SVG. Ce circuit permet de conserver le
comportement de la fixture sans modifier le core ni prétendre définir une API
générique de collections SVG. Il ne doit pas être réutilisé comme exemple de
composant V2 conforme.

La closure qui partage le repère SVG avec `initCaptureState`, la mutation DOM
des chemins accumulés et le retour visuel temporisé après sauvegarde sont des
choix propres à cette démonstration. Le runtime V2 reste responsable de la
capture, du routage des events, du journal, des straps et de l'appel à
`Component.update()`.

La restauration V2 calcule le prochain identifiant à partir des traits
restaurés. Le composant V1 pouvait reprendre à `0` après restauration et
remplacer visuellement un trait ayant déjà cet identifiant ; ce cas est corrigé
dans la fixture V2 pour préserver l'accumulation.

À la demande du 2026-09-23, le commit V2 préserve plus de détail que les seuils
V1 : il filtre les échantillons à moins de `1 px`, simplifie avec une tolérance
de `0,5 px` et sérialise les coordonnées SVG au millième de pixel. Cette
différence vise à éviter la dégradation visuelle des traits persistés ; elle
reste propre à la fixture et ne définit pas une règle normative de géométrie.

## Acceptance path restant

- Tracer plusieurs traits, relâcher puis annuler un geste, et vérifier que le
  live path et les traits persistants sont projetés par les mêmes instances.
- Vérifier qu'aucun geste ne démarre avant Play, puis tracer après le démarrage.
- Recharger la page et vérifier la restauration, puis effacer et recharger pour
  vérifier l'absence de traits restaurés.
- Comparer un tracé fin avant et après commit puis après rechargement pour
  vérifier que la persistance ne lui retire pas de détail visible.
- Redimensionner la fenêtre et vérifier le repère au geste suivant.
- Vérifier l'absence de listeners et de timers conservés après démontage.

La démo reste **En cours** tant que ce parcours n'a pas été vérifié dans le
navigateur.
