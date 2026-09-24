# Layout partagé des démos V2

## Rôle

`src/v2/layout/` possède la page commune des démos V2 : en-tête, sélecteur,
zone de scène, télécommande, journal et cycle de vie de l'instance.

## Interaction avec la scène

- Le DOM de la scène reste monté quand l'instance est prête, mais son hôte est
  `inert` avant le premier passage de l'instance à `playing`.
- Le layout enlève `inert` après avoir observé ce premier démarrage avec
  `instance.telco.onChange`. L'interaction reste ensuite disponible quand la
  lecture est en pause ou repositionnée.
- Chaque montage d'instance réarme le verrou. Un rechargement de scène doit donc
  attendre son propre premier démarrage.
- Le verrou couvre les interactions utilisateur avec le DOM de la scène,
  notamment le pointeur et le clavier. Il ne bloque ni la télécommande, située
  hors de la scène, ni les eventimes d'initialisation émis par le module.
- Le layout s'appuie sur l'état public de la telco et sur `inert`. Il ne change
  pas la sémantique runtime des captures ou de `instance.events.emit()`.

## Frontières

La telco publique est la source de l'état de lecture. Le layout partagé possède
le verrou d'entrée utilisateur parce qu'il possède l'hôte DOM commun. Une démo
ne doit pas créer un second player ni un circuit d'eventimes pour empêcher une
interaction avant le démarrage.

Le parcours d'acceptation et son statut d'implémentation sont suivis dans le
[plan du verrou d'entrée](../plan/2026-09-23-v2-layout-launch-gate-plan.md).
