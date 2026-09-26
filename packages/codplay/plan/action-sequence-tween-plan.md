# Plan d'acceptation — ActionSequence et TweenAction V2

## Statut

> Status: En cours — le comportement partiellement vérifié est décrit dans la
> [spécification](../specs/action-sequence-tween-v2-spec.md) ; les cas
> d'acceptation restants ci-dessous ne sont pas certifiés.
> CodPlay version: V2 foundation

## Travail restant sur le contrat logique

- [ ] Vérifier les offsets `startAt` et la durée implicite d'un `TweenAction`
      dans une `ActionSequence` ; vérifier que `durationMs` remplace cette
      durée implicite et que le pas suivant est chaîné sur la durée retenue.
- [ ] Vérifier le remplacement d'un pas séquencé contenant une `TweenAction`.
- [ ] Vérifier `tween:stop` lorsqu'il rencontre une `TweenAction` dans une
      séquence. Le test actuel intitulé « direct and sequenced » n'exerce que le
      cas direct.
- [ ] Fixer et valider le contrat des fonctions qui retournent `undefined`, un
      payload invalide ou qui lèvent une exception ; le résolveur contient déjà
      des branches pour ces résultats, mais les tests ciblés ne les établissent
      pas encore.
- [ ] Vérifier que l'expansion d'une séquence reste dérivée de l'occurrence
      source sans ajouter d'événement au journal.

La validation ciblée existante est donnée dans la spécification. Compléter ces
cas par des tests du pipeline et du player avant d'étendre la portée de la
spécification ou de marquer cette tranche `Fini`.

## Extensions non décidées

Ces sujets ne font pas partie de l'acceptation de la tranche logique actuelle.
Avant une intégration de rendu continu, décider explicitement :

- si `TweenAction` suffit comme surface auteur ou si un type public `Behavior`
  est nécessaire ;
- si les options temporelles ACE `loop`, `loopDelay`, `reversed` et
  `alternate` sont acceptées sur un comportement auteur, et comment vérifier
  leur reconstruction de scène aux frontières Play/Seek ;
- si un chemin préparé doit être disponible aux `TweenAction` auteur. Le chemin
  de `move` est déjà couvert par sa spécification ; cette décision concerne
  uniquement les tweens continus autonomes ;
- si `spring`, les keyframes explicites ou les coordonnées polaires ont une
  surface auteur V2. Leurs primitives ACE testées isolément ne leur donnent pas
  ce statut ; définir aussi le raccord éventuel entre durée de stabilisation
  du ressort et durée du tween ;
- comment plusieurs actions continues composent leur présentation et si un
  mode pondéré/additif est nécessaire. `blend`, ses poids et ses modes ne sont
  pas un contrat V2 adopté ; fixer la règle avant toute intégration qui en
  dépend ;
- où passe la frontière entre l'évaluation logique et la matérialisation pour
  HTML, SVG et les projections natives ;
- si un scheduler, `context.live` ou des hooks d'annulation/lifecycle ont une
  place dans ce contrat V2.

Aucune de ces extensions n'est décrite comme comportement V2 certifié. Leur
acceptation devra préserver le chemin logique Play/Seek spécifié et être reliée
à ses preuves runtime. Les calculs ACE vérifiés isolément sont décrits dans la
[spécification ACE](../specs/ace-calculation-v2-spec.md). L'inventaire des cas
V1 et le contexte de ces questions restent dans la
[note Behavior](./notes/2026-08-23-v1-behavior-inventory.md) ; elle n'ajoute
aucune API V2.

La rationale de séparation entre valeurs temporelles et occurrences planifiées,
ainsi que la question non décidée d'un cycle `context.live`, est conservée dans
la [note dédiée](./notes/2026-08-01-context-live-evolution.md).
