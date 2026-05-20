# Reprise refonte sequence event-driven

## Fil d'execution courant

1. noter les decisions validees dans `evolution/101-session-context-2026-05-19-sequence-event-driven-refonte.md`
2. retirer du player le pivot `waitingForExternalEvent`
3. faire charger toutes les stories des `init`
4. injecter les `eventimes` de toutes les stories dans le `trackManager` sans `schedule`
5. conserver `play/pause/seek/rewind` sur la base du `trackManager`
6. introduire le verrou terminal `sequence:end`
7. conserver `onSequenceEnd` comme hook post-verrouillage
8. adapter les scenes/tests qui reposaient sur `schedule`
9. verifier les tests cibles puis elargir si besoin

## Points de vigilance

- ne pas casser `seek` et `rewind`
- ne pas reintroduire une fin implicite de sequence
- ne pas melanger le chantier principal avec la spec annexe de tracks de pause
- ne pas garder d'extension d'API non contractuelle dans le runtime

## Reprise suivante

1. partir de `evolution/102-mini-spec-deferred-events-and-media-reload.md`
2. repartir sur un modele `offsetMs` event place immediatement dans la sequence, pas sur un timer runtime transitoire
3. retirer ou remplacer l'experimentation d'emission differee non specifiee avant de poursuivre
4. traiter le doublon audio comme un contrat runtime media global, avec `seek` qui pause les medias en lecture et `rewind` qui les stoppe

## Etat courant

- pipeline runtime strap implemente sur `Player` / `CodPlay`
- `s4` valide le compteur strap avec events timeline + timeout + neutralisation par desactivation de tracks helper
- media `seek/rewind` corriges cote runtime
