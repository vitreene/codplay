# Lot 15 - adaptation script animation Eddy (manuel)

## Objectif

Adapter un snapshot Eddy (`persos[]` + `eventtimes`) au pipeline actuel pour permettre un run visuel manuel sur la page player + telco locale.

## Fonctions noyau

- `adaptEddySnapshot(snapshot, options?)`
  - normalise `persos[]` vers `Record`
  - normalise `eventtimes` vide en mode preview
- `convertEddySnapshotToScene(snapshot, options?)`
  - convertit via `convertLegacyToV1`
  - retourne un `SceneDoc` compatible `createPlayer`
- `renderInitialScene(scene, mountTarget)`
  - rendu initial de la hierarchie scene dans la page
- `main.ts`
  - charge fixture Eddy manuelle
  - injecte le style scope demande pour ce test
  - affiche etat conversion + rendu

## Contrat runtime

- mode manuel prioritaire: pas de comparaison automatique temporelle
- le snapshot manuel Eddy inclut maintenant `eventtimes` builder reel (Map)
- si `eventtimes` est vide:
  - en preview: normalisation vers bucket vide `0ms` + warning
  - hors preview: echec conversion strict (`E_NO_EVENTTIMES`)
- le style scope fourni par l'utilisateur est injecte tel quel dans la page de test

## Scenarios de test (DoD)

- `L15-T1` adaptation `persos[]` -> input convertisseur
- `L15-T2` normalisation preview pour `eventtimes` vide
- `L15-T3` echec strict sans preview
- `L15-T4` conversion du snapshot manuel fourni

## Critere de passage

- 4 tests verts (`tests/lot15`)
- non-regression lots 1 a 14
