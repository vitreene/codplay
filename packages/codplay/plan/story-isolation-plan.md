# Plan — isolation exclusive déclarative des stories

## Statut

> Status: En cours — contrat validé, implémentation intégrée; gates complets encore ouverts
> CodPlay version: V2 foundation
> Spécification: [`../specs/story-isolation-spec.md`](../specs/story-isolation-spec.md)

Ce plan met en œuvre l'isolation runtime définie par la spécification. Il ne
crée ni manager de stories, ni second player, ni instance supplémentaire.

## Avancement au 2026-09-08

Les tranches 1 à 3 sont implémentées et couvertes par les tests de compilation,
du journal et du dispatcher. La tranche 4 est intégrée, avec une correction du
routage des sorties de straps explicitement ciblées : elles ne sont plus
traitées comme des cascades scène, ce qui empêchait un plan futur d'une story
de contaminer le Seek d'une autre. La régression correspondante est dans la
façade de la démo `position`.

La tranche 5 est intégrée dans la fixture `position` et vérifiée sur la page
Safari MCP existante de `5173` : le parcours atteint `06 / 06` après cinq
transitions et le cycle réel de Seek ne reproduit plus l'erreur structurelle.
La mesure instrumentée du parcours Play a compté 1 830 appels à
`getBoundingClientRect` et 1 830 lectures de style calculé ; elle ne constitue
pas encore une comparaison de baisse, faute de référence rejouée avec le même
protocole.

Les validations ciblées passent (7 fichiers, 100 tests), ainsi que le
typecheck CodPlay V2, le typecheck des démos V2 et leur build. Le statut reste
`En cours` : la suite CodPlay complète compte 226 fichiers passés et 1 fichier
en échec (le test éditeur existant `scene-player-bridge-v2.spec.ts`), et les
gates globaux resize, persistence et lifecycle doivent encore être clôturés.

## Prérequis et limites

- le contrat `listen` et le ciblage story existants restent le circuit unique ;
- `StoryDoc.disabled` reste une décision de compilation statique ;
- les contrôles d'activation des tracks ne sont pas réutilisés ;
- aucune modification de la démo ne doit contourner une lacune du runtime ;
- aucune modification de `packages/codplay` core n'est acceptée hors des étapes
  de ce plan et de leurs tests.

## Mise en œuvre ordonnée

### 1. Étendre la déclaration et la compilation — Fait

- ajouter `active?: boolean` à la règle auteur et à sa forme compilée ;
- rejeter une règle `active` au niveau scène ;
- construire l'index exact des règles `active: true` par story et par nom ;
- diagnostiquer les doublons d'activation pour une même story et un même nom ;
- conserver l'index dans le `CompiledScene` sans l'exposer à la façade.

**Gate :** une scène compilée distingue les règles de réveil sans inspecter les
événements à l'exécution ; les scènes existantes sans `active` restent
identiques.

### 2. Introduire la période d'isolation dans le journal — Fait

- définir l'identité interne d'une activation ;
- journaliser les ouvertures et clôtures comme frontières ordonnées ;
- propager l'identité aux faits story-level, aux sorties de straps et aux
  occurrences différées ;
- conserver les faits historiques sans suppression ni nouveau journal ;
- exposer au materializer uniquement les occurrences éligibles à la période
  projetée.

**Gate :** une occurrence `repeat` créée avant une clôture est relue avant la
frontière et ignorée après celle-ci ; une réactivation ne la réutilise pas.

### 3. Raccorder le dispatcher — Fait

- résoudre la cible story avant la sélection du pipeline ;
- consulter l'index de réveil avant le filtre d'une story inactive ;
- ouvrir ou clôturer la période dans la même transaction que l'événement ;
- exécuter `active: true` avec `reset: true` sans état intermédiaire ;
- empêcher toute exécution `listen` d'une story inactive sans règle de réveil ;
- garder les événements scène non rattachés hors de l'isolation.

**Gate :** l'événement d'entrée réactive réellement une story inactive, tandis
qu'un événement ordinaire destiné à cette story reste uniquement journalisé.

### 4. Vérifier la reconstruction et la présentation — Intégrée; validation complète en cours

- projeter les périodes selon la frontière temporelle et l'ordre des faits ;
- préserver la lecture historique avec Seek avant/après clôture ;
- ne pas remonter, démonter ou recréer les nœuds auteur ;
- ne pas modifier le reset existant, la visibilité, l'horloge ou l'état de
  scène ;
- vérifier les occurrences `move` et les ressources motion invalidées lorsqu'une
  période fermée les portait.

**Gate :** Play et Seek produisent la même projection et aucun plan obsolète ne
réapparaît après un changement de story.

### 5. Validation intégrée de la démo position — Intégrée; validation complète en cours

- ajouter les règles `active` aux stories de la fixture sans créer de circuit
  de navigation parallèle ;
- enchaîner plusieurs stories puis revenir à une story déjà jouée ;
- vérifier les `repeat`, les reparentages, les resets et les événements de
  visibilité avec le journal réel ;
- mesurer l'absence d'appels ou de matérialisations provenant de la story
  précédente ;
- exécuter les tests ciblés, typecheck, build, Play, Seek, resize, persistence,
  lifecycle et le parcours Safari demandé pour la démo.

**Gate :** la démo valide le chemin runtime réel ; aucun correctif propre à la
fixture ne masque une défaillance du contrat.

## Critère de sortie

Le plan ne passe à `Fini` qu'après :

- tests de compilation, dispatcher, journal, projection et materializer ;
- tests de non-régression reset, parent/enfant, reparentage et événements scène ;
- validation Play/Seek/resize/persistence/lifecycle ;
- validation navigateur réelle de la démo position, Safari inclus ;
- mise à jour de cette spécification avec les décisions d'implémentation ;
- typecheck, tests, build et `git diff --check` propres.
