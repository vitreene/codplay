# Stabilisation V2 — intégrations tierces et pont de cibles

> Statut : En cours. Périmètre courant : frontières communes et intégrations
> Three.js/Rive existantes. Lottie et les nouvelles surfaces auteur sont des
> [évolutions à affecter](./evolutions/evolution-backlog.md#composition-des-packages-et-nouveaux-composants-tiers).

## Contrats et propriétaires

Les références vérifiées sont les spécifications [rel](../specs/third-party-rel-spec.md),
[pont de cibles](../specs/third-party-target-bridge-spec.md),
[bibliothèques](../specs/third-party-library-spec.md),
[Three.js](../specs/third-party-threejs-spec.md) et
[Rive](../specs/third-party-rive-spec.md).
Le [plan Avatar](./2026-09-19-avatar-components-v2-plan.md) possède ses
écarts de pose, son périmètre TalkingHead et son acceptation propres.

Une convention native reste dans son intégration. Toute lacune générique
établie par ces parcours doit recevoir une décision et une autorisation
explicites avant modification du cœur. Le classement des évolutions ne
qualifie pas le pont de générique pour une famille non validée.

## Acceptation commune du pont

1. Comparer propriétaires de contexte, identités, cardinalités, temps,
   ressources et diagnostics des intégrations existantes. La comparaison
   Lottie reste dans son évolution séparée avant qualification transverse.
2. Couvrir isolation engine/player, publication après montage, cible
   temporairement indisponible puis remontée et plusieurs consommateurs.
3. Couvrir préparation et échec de bibliothèque/ressource, Seek avant/arrière,
   reset, replay, resize et destruction sur les vraies intégrations.
4. Utiliser les runners réels dans Safari et un second navigateur. Les
   cibles factices et runtimes synthétiques ne ferment pas cette acceptation.

## Acceptation par intégration

- Three.js : destruction complète, isolation des hosts et players,
  caméra/couleurs pilotées au temps CodPlay et commit final du vrai host.
- Rive : Play/Seek, resize, retour temporel, remontage et destruction avec un
  fichier Rive et le runtime réels. Ne pas déduire ce comportement d’un artboard
  synthétique.
- Conserver un seul journal, registre de capacités, preload et cycle temporel
  CodPlay ; les intégrations possèdent leurs objets et ressources natives.

## Clôture

Fermer les validations applicables aux familles retenues et transférer
uniquement les comportements intégrés et vérifiés dans les spécifications.
Les packages, opérations auteur, Lottie et `sync` restent dans leur plan
d’évolution ; ils ne sont pas présentés comme implémentés par cette clôture.
