# Text micro-animations V1

## Statut

Reference de cadrage V1 pour les micro-animations du composant `text` evolue.

## Preambule - intention

Fournir des animations de texte reutilisables, lisibles par auteur, et deterministes.

Le principe retenu:

- presets pre-definis (pas de script auteur libre)
- execution interne composant + librairie animation
- interruptions explicites et previsibles
- methode commune: split texte + animation stager de quelques proprietes + execution rapide
- integration au pipeline animation global du Player

## Portee

Ce document couvre:

- definition d'une micro-animation
- contrat des presets
- politique de concurrence/interruption
- limites de longueur et fallback
- transport des donnees vers la librairie animation

Ce document ne couvre pas:

- la spec complete `text advanced`
- la totalite du schema rich text
- les animations de type list/reparent

## Definition

Une micro-animation est une animation d'un contenu texte pour lequel l'auteur n'a acces qu'a des proprietes pre-definies.

Regles:

- aucune emission d'event public
- aucun impact direct sur Eventime/journal canonique
- scope local composant `text` + librairie animation

## Preconditions

- appliquee uniquement sur textes de longueur limitee
- si la longueur depasse le seuil policy, fallback automatique (texte simple ou mode degrade)
- segmentation unicode: support emoji requis

## Segmentation texte

Niveaux V1 autorises:

- `word`
- `char`
- `word+char`

Regles:

- en mode `char`, segmentation par graphemes sur cas emoji
- preservation des espaces visibles (`white-space: pre` ou equivalent adapter)

## Contrat preset

Format recommande:

```ts
type TextMicroAnimationPresetName = 'zoom-in-stagger'

type TextMicroAnimationInput = {
  preset: TextMicroAnimationPresetName
  unit: 'word' | 'char' | 'word+char'
  durationMs: number
  staggerMs: number
  easing?: string
}
```

Note V1:

- `zoom-in-stagger` est un preset de reference
- le catalogue de presets est extensible (plusieurs dizaines possibles)
- les presets partagent globalement le meme procede runtime

## Procede commun des presets

La majorite des presets texte suivent le meme schema:

1. split du texte (`word`, `char`, ou `word+char`)
2. definition de quelques proprietes animees (ex: `opacity`, `scale`, `y`)
3. calcul d'un stagger court par unite
4. execution rapide de la transition

Contraintes:

- nombre de proprietes animees volontairement limite
- durees courtes privilegiees
- interruption/reprise selon la policy commune

## Preset V1: zoom-in-stagger

Description:

- unite initiale a `scale(0)` + `opacity: 0`
- animation vers `scale(1)` + `opacity: 1`
- decalage progressif par index (`staggerMs`)

Parametres:

- `durationMs`
- `staggerMs`
- `easing`

## Pipeline runtime

1. composant recoit un update avec action micro-animation
2. composant segmente le texte selon `unit`
3. composant prepare les nodes segmentes et snapshots courants
4. composant envoie les transitions a la librairie animation
5. composant maintient un handle d'animation active

## Politique de concurrence (validee)

Regles:

- une micro-transition capture son etat initial au moment exact de son demarrage
- si une nouvelle micro-transition arrive:
  - interruption immediate de l'animation en cours
  - capture de l'etat courant au moment de l'interruption
  - redemarrage depuis cet etat courant vers le nouvel etat final

Invariant:

- pas de file d'attente de transitions en V1

## Transport vers la librairie animation

Format interne recommande:

```ts
type TextMicroAnimationTransition = {
  transitionId: string
  target: unknown
  property: 'scale' | 'opacity'
  from: number
  to: number
  duration: number
  delayMs: number
  easing?: string
}
```

Regles:

- transitions derivees de la segmentation (`unit`)
- pas d'emission d'event public associe
- arret via handle local composant sur interruption

Contrainte V1:

- contrairement a un exemple autonome en CSS keyframes, les micro-animations doivent etre transmises a la librairie animation (`animejs` via l'adapter runtime)
- objectif: simplifier la gestion des etats animation sur evenements Player (`play`, `pause`, `seek`)
- les micro-animations ne sont pas hors-systeme: elles suivent la gestion globale des animations

## Contraintes temporelles

- pilotage frame-based (`Ticker`/scheduler)
- timers legacy proscrits

## Integration pilotage Player

Les micro-animations doivent respecter le pilotage global:

- `play`: reprise des animations en coherence avec l'etat runtime
- `pause`: suspension des micro-animations actives
- `seek`: arret/realignement des micro-animations selon la position cible

Regle:

- le composant delegue ce controle au pipeline animation commun, pas a un mecanisme local isole

## Policies perf recommandees

`runtimeConfig` recommande:

- `textMicroAnimationEnabled` (boolean)
- `textMicroAnimationMaxChars`
- `textMicroAnimationMaxWords`
- `textMicroAnimationFallbackMode` (`none` | `simple-fade` | `disable`)

## Warnings auteur recommandes

- `AUTHOR_TEXT_MICRO_ANIMATION_PRESET_UNKNOWN`
- `AUTHOR_TEXT_MICRO_ANIMATION_UNIT_INVALID`
- `AUTHOR_TEXT_MICRO_ANIMATION_TEXT_TOO_LONG`
- `AUTHOR_TEXT_MICRO_ANIMATION_INTERRUPTED`

## Tests smoke recommandes

1. `zoom-in-stagger` sur texte court (char)
2. interruption par nouvelle transition avant fin
3. reprise depuis etat courant apres interruption
4. texte trop long => fallback policy
5. texte avec emoji en mode `char`
6. verification absence d'events publics emis

## Liens

- `20-text-advanced-pre-spec.md`
- `19-text-component-v1.md`
- `17-user-events-emit-v1.md`
