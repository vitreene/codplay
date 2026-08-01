# CodPlay V2 - gel de perimetre CompiledScene

## Statut

Decision active de chantier. Le perimetre actuel est suffisant comme fondation
structurelle pour alimenter une future verticale de rendu, mais il ne constitue
pas encore un flux player/engine complet.

## Ce qui est couvert

- contrats `SceneDoc`, canonique et `CompiledScene`;
- normalisation structurelle et auto-reference interne;
- guards et catalogue de validation core;
- builder initial : stories actives, fonctions externes, requirements, ressources
  V1 et candidats de racine;
- adapters ACE transform/couleur et valeurs unitisees;
- resolution `from` deterministe ou differee avant preparation ACE;
- codec JSON versionne de l'enveloppe et validation structurelle;
- freeze de l'artefact compile et tests de contrat.

## Ce qui reste explicitement hors perimetre

- player, engine, materialize, resolve et solve;
- composants et source unique de leurs services;
- sanitation des proprietes par contrat de composant/service;
- defaults complets et matrice des proprietes;
- conversion des unites dans `render`;
- resolution des `from` runtime depuis l'etat logique;
- codec semantique complet, migrations et politique d'extensions;
- parite player V1/V2, traces temporelles et baselines DOM/geometriques;
- move, layout, FLIP, media runtime, capture et DnD.

## Regle de demo

Aucune demo ne doit etre construite sur le seul perimetre `CompiledScene` pour
simuler un flux de rendu. Apres la tranche `engine/player`, une verticale de test
peut utiliser un sink de rendu temporaire en memoire, sans ouvrir les composants
ni le renderer de production. La demo temporaire de validation peut rester visible
pendant les travaux Clock/Ticker et runtime; elle sera retiree uniquement quand les
composants seront ouverts. Les fixtures S1-S4 restent des fixtures de build et de
forme, pas des demos V2.

## Suite autorisee

La tranche `CompiledScene` peut rester gelee comme fondation testee. Toute reprise
ulterieure doit commencer par le plan de la verticale consommatrice et ne doit pas
ajouter de capacite de rendu dans le builder pour faire avancer une demo.
