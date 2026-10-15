# Façade CodPlay V2 — extensions restantes

> Statut : En cours pour l'observation de `snapshot` et l'entrée de diffusion
> d'un paquet de scène ; aucune de ces extensions n'est encore implémentée.
> Le contrat public actuellement implémenté et vérifié est dans la
> [spécification façade](../specs/facade-v2-spec.md).

## Autorité et périmètre

La spécification façade fait foi pour la surface publique vérifiée : propriétaire
`CodPlay`, compilation, registres, ressources, moteur, instances, telco,
événements, previews logiques, projection `input`, présentation numérique et
montage interinstances. Les comportements plus précis restent dans leurs
spécifications et plans dédiés :

- [Engine et Player](../specs/engine-player-v2-spec.md) et son
  [plan d'acceptation](./player-engine-plan.md) ;
- [pipeline événementiel](../specs/event-pipeline-v2-spec.md) ;
- [projection `input`](../specs/input-projection-spec.md) ;
- [montage de contenu foreign](./foreign-scene-component-plan.md) ;
- [preload et diffusion](./media-preload-plan.md) ;
- [préparation et présentation motion](./motion-live-discovery-invalidation-plan.md)
  et [intégration FLIP](./runner-flip-integration-study.md).

Les contrôles navigateur sont suivis par les plans des comportements concernés.
Aucune gate navigateur propre à la façade n'est définie au-delà de ces parcours.

## Entrée d'un paquet de scène — forme demandée, non implémentée

L'utilisateur demande `new CodPlay(root, scenePath)`, une préparation
`await cp.init()` et une lecture `cp.play()`, directement sur l'objet CodPlay.
La forme et l'acceptation sont suivies dans la
[feuille de route d'export, §8](./2026-10-15-export-diffusion-plan.md#8-initialisation-côté-site-à-prouver).
Le choix retient une préparation asynchrone explicite ; le constructeur
historique et le multi-instance doivent rester couverts par les tests.

Le raccord doit prolonger `codplay-facade.ts` et ses types, avec une logique
dédiée de chargement dans un dossier de feature de la façade si nécessaire.
Il réutilise le catalogue, le preload, le registre d'instances et la telco ;
il ne crée pas une seconde classe de player ni un second propriétaire CodPlay.
Les règles complémentaires de cycle et les détails d'export encore ouverts
restent dans le plan d'export. Cette entrée ne change pas la spec vérifiée et
n'autorise pas à elle seule du code dépendant des décisions `A relire`.

L'[audit de compatibilité auteur](./2026-10-15-export-diffusion-plan.md#audit-de-compatibilité-avec-le-mode-auteur--2026-10-15)
ne trouve pas de collision de noms. Il ajoute la gate de conservation du
constructeur par options, du mode auteur sans init public, du ciblage telco
et de la propriété de destruction. La coexistence auteur/diffusion devra
être prouvée avant de certifier la surcharge ; les échecs actuels de validation
éditeur y sont explicitement distingués de cette extension non implémentée.

## Décision non prise : observation des changements de snapshot

L'API vérifiée reste `instance.snapshot.get()`, `set(patches)` et `clear()`.
Une notification telle que `snapshot.onChange` n'est ni décidée ni implémentée.
Le contrat existant reste suffisant tant qu'aucun consommateur ne demande une
observation directe.

Si un besoin concret justifie cette extension, décider avant toute modification
du cœur :

1. quels changements sont observés : état de base présenté, opérations de
   preview réussies, ou les deux ;
2. si une preview change le signal alors que `get()` continue de renvoyer l'état
   de base ;
3. la forme de la donnée relue par le consommateur et l'appel initial éventuel ;
4. l'ordre des notifications par rapport à `set`, `clear`, `seek` et à la
   présentation ;
5. l'isolation des erreurs, le désabonnement et le comportement après
   destruction.

Le parcours d'acceptation devra couvrir la lecture initiale, la pose, le
remplacement et l'effacement d'une preview, un seek vers un autre temps puis le
retour, ainsi que la destruction. Il devra prouver qu'un seul circuit de
présentation est observé. Aucun nom de méthode, DTO ou événement ne constitue
un contrat avant cette décision.
