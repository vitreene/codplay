# Scenario 05 - Form submit backend via strap

## Intention

Completer le flux d'attente avec un formulaire:

- l'utilisateur saisit un texte
- un bouton valider lance un submit backend
- la logique metier et les side-effects sont geres par un strap
- en succes, la story d'attente se termine et le scenario poursuit

## Preconditions

- `story-main#1` joue normalement
- `story-wait#1` est ouverte via `startWait({ mode: 'parallel' })`
- un formulaire est visible dans `story-wait#1`
- un strap est abonne a l'action submit

## Sequence API recommandee

1. user click sur `btn-submit`
2. strap lit la valeur du formulaire
3. strap appelle `effect.run('form.submit', payload)`
4. si succes:
   - `scenario.resolveWait({ waitId })`
   - `scenario.gotoStory({ storyId: 'story-next', instanceId: 'story-next#1' })`
5. si echec:
   - strap met a jour un item d'erreur
   - attente conservee (retry possible)

## Effets attendus

- player global continue (pas de pause implicite)
- pendant `pending`, animations et events paralleles restent possibles
- l'issue narrative depend explicitement du resultat backend

## Traces attendues (extrait)

```text
USER     pointer:click target=btn-submit
strap:effect:requested name=form.submit correlationId=...
strap:effect:started correlationId=...

// succes
strap:effect:succeeded correlationId=...
scenario:wait:resolve waitId=...
scenario:goto-story storyRef=story-next#1

// echec (alternative)
strap:effect:failed correlationId=... code=EFFECT_TIMEOUT
ITEM     PATCH formError
```
