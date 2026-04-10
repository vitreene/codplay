# Event model V1 - socle minimal

## But

Definir un modele d'event minimal, deterministe et suffisant pour le socle V1.

Le principe est de rester simple:

- champs indispensables seulement
- ordre canonique explicite
- extension possible plus tard

## Portee

Le modele couvre:

- events publics traites par le `Director`
- journal canonique replay
- ordre d'execution scene-level

Il ne couvre pas encore:

- schema avance de correlation/telemetrie
- details riches de tracing

## Principe global

- tout event est public a l'echelle scene
- toutes les stories actives peuvent le recevoir
- filtrage et mapping restent de la responsabilite des stories

## Enveloppe minimale V1

Champs requis:

- `eventId`: identifiant d'event
- `eventSeq`: sequence monotone globale
- `name`: nom d'event
- `applyAtMs`: temps cible base sur le `Timer` commun
- `source`: source logique (`user | director | system | replay`)

Champs optionnels:

- `data`: payload metier/technique
- `meta`: bloc optionnel de debug

Regles V1:

- si `eventId` existe en entree, il est conserve
- sinon `eventId` est genere par le `Director`
- `eventSeq` est toujours assigne par le `Director`

## Ordonnancement canonique

Regle d'ordre:

1. `applyAtMs` croissant
2. a egalite, `eventSeq` croissant

Invariant:

- `eventSeq` tranche toujours les egalites temporelles

Regle track-specifique:

- un `tracks:set` de sequence `N` n'affecte que les events `> N`

## Journal canonique V1

Le journal canonique est tenu par le `Director`.

Regles:

- ecriture apres normalisation
- journalisation de tous les events publics traites
- tokens internes de `listen` non journalises (derivables)

## Evenements internes vs publics

- events publics: scopes scene, journalises
- tokens internes story: scopes story, non publics, non journalises

Un token interne peut emettre un event public:

- emission immediate dans le meme cycle `Director`
- attribution du `eventSeq` suivant

## Erreurs auteur et validation

Exemples d'erreurs auteur V1:

- nom d'event vide
- format d'event invalide
- `tracks:set` avec track inconnue
- `tracks:set` avec meme track dans `activate` et `deactivate`

Reaction runtime:

- depend de la policy d'execution (`author`/`user`) via configuration

## Extensions futures (hors V1 minimal)

Champs possibles plus tard:

- correlation
- domain/time refs enrichies
- traces fines par etape

Ces extensions ne doivent pas casser le noyau minimal V1.

## Diagramme simple

```mermaid
flowchart LR
  IN[Event public entrant] --> N[Normalisation Director]
  N --> J[Journal canonique]
  N --> D[Dispatch stories]
  D --> OUT[Events publics sortants]
  OUT --> N
```

## Lien avec les autres specs

- `02-story-model.md`: consommation locale et tokens internes
- `04-eventime-model.md`: production temporelle par track
- `06-runtime-contract.md`: passage vers commits renderer
