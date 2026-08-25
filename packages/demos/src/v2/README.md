# Démos CodPlay V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

Ce dossier contient les démos de validation et de présentation de CodPlay V2.
Elles sont distinctes des démos historiques de `src/v1` et ne réutilisent
pas leur circuit de lecture, leur télécommande ou leur registre.

```text
src/v2/
  layout/                 # cadre responsive, télécommande et journal
  demos/<demo-id>/        # une démo autonome par dossier
  registry.ts             # métadonnées et chargement différé
  main.ts                 # entrée V2 légère

src/v1/                    # démos historiques et leur circuit V1
```

La page publique de cette tranche est `index.html`. Le sélecteur change de démo
par l'URL ; le module de la démo sélectionnée est chargé dynamiquement. Le
chargement initial ne compile donc pas toutes les scènes V2.

## Layout commun

Le layout occupe toute la fenêtre sans défilement de page et comporte trois
zones explicites :

1. l'en-tête, avec le titre, la description courte et le sélecteur ;
2. la zone centrale, réservée à la démo et à ses diagnostics visuels ;
3. le pied de page, qui contient la télécommande complète.

Le CSS privilégie Grid, les tailles fluides et les contraintes `min-height: 0`.
`AutoCapsule` peut être utilisé par une démo lorsque sa grille apporte une
valeur réelle ; il n'est pas une dépendance obligatoire du layout.

La télécommande utilise `RuntimeTelco` comme unique façade : play/pause,
rewind, seek continu, vitesse et état. Une démo ne pilote jamais directement
le runner pour remplacer cette façade.

Le journal est une couche d'observation facultative. Son panneau est activable
par un toggle, ses écritures sont regroupées par frame et son conteneur ne
bloque jamais la scène ni la lecture. Les logs d'événements détaillés seront
branchés sur les sorties V2 disponibles ; le layout n'invente pas de traceur
parallèle.

## Règles de transposition

- une démo est acceptée une par une ; son entrée dans `registry.ts` intervient
  après validation de sa transposition V2 ;
- la série historique `s*` est hors de cette migration ;
- les médias nécessaires à une démo vivent dans `packages/demos/public/` ;
- les scènes sont écrites dans la forme normative V2 et passent par le builder
  et le runner V2 ;
- une démo ne masque pas une lacune du core par un circuit local ;
- les materializers tiers restent hors de la première tranche ; ils seront
  introduits seulement lorsqu'une démo et son contrat l'exigeront ;
- `flip-stress` est la première démo déplacée et sert aussi de test du layout.

Les démos conservées pour publication et les démos de validation peuvent
partager leur scène, mais pas créer une seconde horloge, une seconde telco ou
une seconde matérialisation.

Dans `flip-stress`, les lettres `Q` et `K` sont le contenu statique des deux
layouts de transfert qui contiennent chacun leur liste. Elles accompagnent le
layout pendant son déplacement et ne constituent pas des items déplacés par les
flips internes.

Les layouts `C` et `D` sont initialement placés sur `@off` : leurs
matérialisations persistent, mais aucun de leurs nœuds n’est monté dans le stage
avant l’événement de révélation. Cet événement les monte sur `@root` et anime
leur opacité ; `visibility` ne sert pas à simuler leur absence. Le graphe doit
conserver ce cas lorsque K est transféré à la même frontière : son ancêtre peut
être absent au FIRST et présent au LAST. La capture ponctuelle peut alors
mesurer l’attachement FIRST de K dans le contexte des ancêtres montés au LAST,
sur les mêmes materialisations persistantes ; la scène normale reste absente au
FIRST et aucun retard d’événement ne masque ce cas.
