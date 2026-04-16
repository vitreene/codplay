# Sequence user-view progress V1

## Statut

Reference V1 minimale pour la progression percue utilisateur d'une sequence.

## Preambule - intention

L'intention de cette spec est de fournir une progression fiable pour l'utilisateur, sans confondre:

- la duree runtime reelle
- la duree utile de lecture
- les contraintes de navigation liees aux incertitudes

Le resultat attendu est simple a lire cote produit et simple a deployer cote runtime/UI:

- `user-view`: progression percue, deterministe, alignee usage final
- `author-view`: progression et navigation assouplies pour faciliter l'edition

## But

Definir un cadre canonique pour:

- calculer la progression d'une `sequence`
- gerer les zones hors progression (`transition`, `sustain`)
- traiter les incertitudes (branches non resolues)
- separer les etats runtime des etats perus (`user-view`)

## Portee

La spec couvre:

- une seule `sequence`
- les deux vues `user-view` et `author-view`
- le calcul de progression cible
- les regles de seek associees
- le contrat d'evenements progress runtime

## Hors perimetre V1

- gestionnaire temporel complet multi-stories
- contraintes avancees de seek par regles metier fines
- normalisation UI detaillee (format texte, style, couleurs)

## Vocabulaire canonique

- `transition`: zone annexe hors progression (intro/outro/transitions)
- `progress`: zone utile comptabilisee dans la progression utilisateur
- `sustain`: zone de maintien fin de sequence, hors progression
- `user-view`: vue progression contrainte pour experience utilisateur
- `author-view`: vue de travail pour edition et verification
- `incertitude`: point de decision dont la branche n'est pas encore resolue

## Modelisation temporelle

### Bornes tagguees

La sequence est decrite via bornes evenements tagguees, coherentes avec le systeme d'events.

Bornes minimales:

- `progress:enter`
- `progress:exit`

Bornes recommandees selon besoin:

- `transition:enter` / `transition:exit`
- `sustain:enter` / `sustain:exit`

Invariant:

- chaque instant de la sequence appartient a une zone logique connue (`transition`, `progress`, `sustain`)

### Multi-segments `progress`

Une sequence peut contenir plusieurs segments `progress` separes par des `transition`.

Regle V1:

- la duree de reference `user-view` est la somme de tous les segments `progress` pertinents

## Separation des etats

### Etats runtime (techniques)

Les etats runtime pilotent l'execution technique (load/start/pause/seek...).

### Etats `user-view` (percus)

Les etats `user-view` pilotent uniquement le cycle de progression utilisateur.

Etats minimaux:

- `not-started`: avant l'entree en `progress`
- `active`: dans au moins un segment `progress`
- `ended`: sortie definitive de `progress`
- `frozen-no-progress-zone`: aucune zone `progress` auteur disponible

Events canoniques:

- `sequence:user-view:start`
- `sequence:user-view:end`
- `sequence:user-view:progress-updated`

## Regles de calcul `user-view`

### Principes

- `transition` et `sustain` sont toujours exclus du calcul
- la progression demarre a `progress:enter`
- la progression atteint 100% a `progress:exit` final
- le rendu final (`%`, temps restant, texte) reste libre cote UI

### Grandeurs de calcul

- `elapsedProgressDuration`: duree `progress` deja lue
- `remainingPotentialProgressDuration`: duree `progress` potentiellement restante
- `progressRatioTarget`: ratio cible brut a fournir a l'UI

Formule canonique:

```txt
progressRatioTarget =
  elapsedProgressDuration /
  (elapsedProgressDuration + remainingPotentialProgressDuration)
```

Cas limite:

- si aucune zone `progress`: ratio non applicable (`null`), barre figee sans `%`

## Incertitudes et branches non resolues

### Regle de pire cas par point

Pour chaque incertitude non resolue:

- calculer la duree `progress` de chaque branche possible
- retenir la duree maximale de ce point

Puis:

- sommer les maxima de tous les points non resolus
- integrer cette somme dans `remainingPotentialProgressDuration`

### Resolution d'incertitude

A la resolution d'un point d'incertitude:

- recalcul immediate de `remainingPotentialProgressDuration`
- emission de `sequence:user-view:progress-updated`

### Timeouts

Regles V1:

- la duree d'attente timeout est ignoree dans progression et seek
- l'action associee au timeout s'execute normalement
- cette resolution (via timeout) declenche le meme recalcul que toute resolution

## Regles de seek

### User-view

Regles minimales:

- seek interdit au-dela de la premiere incertitude non resolue
- parametre scene global `seekSkipsTransitionZones` actif par defaut (`true`)

Quand `seekSkipsTransitionZones=true`:

- si cible seek dans `transition`, snap au prochain `progress:enter`

Quand `seekSkipsTransitionZones=false`:

- un seek avant la premiere entree `progress` place la progression en etat `not-started`

### Author-view

Le `author-view` ignore les contraintes `user-view` pour faciliter la verification.

Regles V1:

- seek libre pour inspection editoriale
- progression calculee sur toute la sequence (`transition + progress + sustain`)
- bornes `in/out` disponibles pour lecture partielle uniquement
- `in/out` n'affecte pas le calcul de progression
- `inPoint <= outPoint` obligatoire
- `inPoint` et `outPoint` sont clamps dans la plage temporelle de la sequence
- les events `sequence:user-view:start` et `sequence:user-view:end` restent references a la sequence complete

Gestion des branches non resolues en `author-view`:

- les possibilites sont representees bout a bout
- ordre strict: ordre de declaration auteur
- un reperage visuel (ex: couleur) est autorise cote UI, non normatif V1

## Contrat runtime recommande

Exemple minimal de snapshot:

```ts
type SequenceProgressSnapshot = {
  sequenceId: string
  viewMode: 'user-view' | 'author-view'
  userViewState: 'not-started' | 'active' | 'ended' | 'frozen-no-progress-zone'
  progressRatioTarget: number | null
  elapsedProgressDuration: number
  remainingPotentialProgressDuration: number
  seekSkipsTransitionZones: boolean
}
```

Exemple minimal d'event progress:

```ts
type SequenceUserViewProgressUpdated = {
  name: 'sequence:user-view:progress-updated'
  data: {
    sequenceId: string
    progressRatioTarget: number | null
    elapsedProgressDuration: number
    remainingPotentialProgressDuration: number
    reason:
      | 'tick'
      | 'seek'
      | 'uncertainty:resolved'
      | 'timeout:resolved'
      | 'zone:enter'
      | 'zone:exit'
  }
}
```

Non requis en V1:

- pas d'event `sequence:view-mode:changed`
- pas d'event `sequence:author-view:in-out-updated`

## Commandes host recommandees

Commandes minimales pour un deploiement simple:

- `setSequenceViewMode(mode)`
- `setAuthorInOutWindow(window)`
- `clearAuthorInOutWindow()`
- `getSequenceProgressSnapshot()`

Exemple de types:

```ts
type SequenceViewMode = 'user-view' | 'author-view'

type AuthorInOutWindow = {
  inPoint: number
  outPoint: number
}

type SetSequenceViewModeResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }
```

Regles:

- `setSequenceViewMode('author-view')` active les regles de seek/lecture author
- `setSequenceViewMode('user-view')` restaure les contraintes user-view
- `setAuthorInOutWindow` est valide uniquement en `author-view`
- `clearAuthorInOutWindow` restaure la lecture author sur toute la sequence
- aucune emission d'event dediee n'est imposee pour ces commandes en V1

## Politique de configuration

Configuration minimale recommandee (niveau scene/runtime):

- `viewModeDefault`: `'user-view' | 'author-view'` (defaut: `user-view`)
- `seekSkipsTransitionZones`: boolean (defaut: `true`)

Regle:

- lissage visuel hors runtime (UI-only)

## Algorithme de reference

1. Resoudre zone courante (`transition` / `progress` / `sustain`).
2. Resoudre etat `user-view` (`not-started` / `active` / `ended` / `frozen-no-progress-zone`).
3. Calculer `elapsedProgressDuration` selon segments `progress` traverses.
4. Calculer `remainingPotentialProgressDuration`:
   - partie `progress` connue du chemin courant
   - plus somme des maxima `progress` pour chaque incertitude non resolue.
5. Deriver `progressRatioTarget` ou `null` si non applicable.
6. Emettre `sequence:user-view:progress-updated` si variation significative.

## Integration UI (normatif leger)

- le runtime fournit une valeur cible brute `progressRatioTarget`
- l'UI applique un lissage configurable sans modifier la semantique
- l'UI choisit librement le rendu final (`%`, temps restant, barre seule)
- en `frozen-no-progress-zone`: barre figee, `%` masque

## Erreurs et warnings minimaux

Erreurs auteur recommandees:

- `AUTHOR_PROGRESS_BOUNDS_INVALID`
- `AUTHOR_PROGRESS_BOUNDS_OVERLAP_INVALID`
- `AUTHOR_PROGRESS_ZONE_MISSING`

Erreurs host/runtime recommandees:

- `HOST_VIEW_MODE_INVALID`
- `HOST_AUTHOR_IN_OUT_INVALID`
- `HOST_AUTHOR_IN_OUT_REQUIRES_AUTHOR_VIEW`
- `HOST_SEEK_BEYOND_UNRESOLVED_UNCERTAINTY`

Warnings runtime recommandees:

- `W_USER_VIEW_PROGRESS_NOT_APPLICABLE`
- `W_USER_VIEW_SEEK_SNAPPED_TO_PROGRESS_ENTER`

## Criteres de completion (deploiement)

- calcul `user-view` stable pour sequence sans branche
- recalcul correct lors resolution d'incertitude
- seek applique les regles de snap/blocage
- timeout applique action sans impacter la duree de progression
- `author-view` lecture partielle `in/out` fonctionnelle
- aucun conflit entre etats runtime et etats `user-view`

## Tests smoke recommandes

1. Sequence lineaire avec intro/outro hors progression.
2. Sequence avec deux incertitudes non resolues (pire cas cumule).
3. Resolution de branche en cours de lecture (reajustement + event).
4. Seek dans transition avec `seekSkipsTransitionZones=true` (snap).
5. Seek avant `progress:enter` avec `seekSkipsTransitionZones=false` (etat `not-started`).
6. Sequence sans zone `progress` (barre figee, pas de `%`).
7. Author-view avec `in/out` actif et branches bout a bout.

## Lien avec les autres specs

- `03-event-model.md`: enveloppe event canonique et ordonnancement
- `04-eventime-model.md`: generation temporelle et tracks
- `06-runtime-contract.md`: articulation Director/Renderer
- `10-api-host-v1.md`: facade host et commandes
- `11-runtime-context-mapping-v1.md`: mapping runtimeConfig/policies
