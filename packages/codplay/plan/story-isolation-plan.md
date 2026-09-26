# Plan d'acceptation — isolation des stories CodPlay V2

> Statut : **En cours**. Le contrat logique vérifié est dans la
> [spécification](../specs/story-isolation-spec.md) ; des gates d'intégration
> et de présentation restent ouvertes.

## Périmètre

Ce plan suit les preuves manquantes de l'isolation lorsqu'elle interagit avec
les occurrences motion, la reconstruction et le cycle de vie du runner. La
spécification porte le contrat logique déjà testé : déclaration `listen.active`,
frontières de période, conservation des faits, réveil ciblé, reset combiné et
indépendance des événements `scene`.

Le parcours `position` a déjà été exercé avec Play et Seek dans Safari. Ce
résultat valide ce scénario et ne clôt pas les gates restantes ci-dessous.

## Gates restantes

- [ ] Vérifier qu'un événement ordinaire adressé à une story inactive reste
  journalisé sans exécuter ses transforms, straps, emits ou resets ; valider
  aussi qu'un événement de réveil ne déclenche chaque effet sélectionné qu'une
  fois.
- [ ] Fermer les frontières d'occurrences `repeat`, différées, de sorties de
  straps et de réinjections : elles restent dans le journal, cessent d'être
  projetées après la clôture de leur période et redeviennent lisibles par Seek
  avant cette frontière.
- [ ] Vérifier les périodes de stories qui contiennent des moves locaux, du
  parentage et du reparentage : aucune occurrence ni ressource motion de la
  période précédente ne doit subsister après le changement de story.
- [ ] Couvrir la séquence d'activation et de clôture pendant Play, Seek avant et
  après la frontière, resize, persistence et destruction du runner, avec une
  seule instance et son journal.
- [ ] Rejouer les parcours d'acceptation CodPlay V2 concernés, puis valider le
  chemin réel de la démo `position` dans Safari après fermeture des gates.
- [ ] Relancer les tests du package CodPlay, son typecheck et le build et le
  typecheck des démos V2 avant de réviser le statut.

La préparation concurrente, l'invalidation des groupes au reset et la
libération de leurs ressources restent coordonnées par le
[plan reset](./story-reset-plan.md) et le
[plan motion](./motion-live-discovery-invalidation-plan.md) ; ces plans
conservent chacun leur propre périmètre.

## Critère de sortie

Garder le plan actif jusqu'à ce que toutes les gates ci-dessus soient fermées.
Transférer alors à la spécification les seuls comportements intégrés et
vérifiés, puis retirer ce plan si aucune décision ni validation ne reste.
