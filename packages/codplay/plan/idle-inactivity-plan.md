# Idle d'inactivité du player V2

**Statut : Fini pour le monitor core V2**  
**Version : CodPlay V2**  
**Contrat accepté le 2026-08-29 à partir de la demande d'intégration de l'idle.**

## Objet

Cette tranche ajoute au runtime CodPlay une détection d'inactivité qui produit un
event dans le circuit normal du player. Elle ne concerne pas une démo et ne lit
pas directement les signaux du DOM.

Un futur niveau d'inactivité de fenêtre pourra être ajouté par un adaptateur
HTML/DOM. Il écoutera les signaux d'interaction de la fenêtre et transmettra
une activité au player ; il ne remplacera pas le monitor du cœur.

L'API navigateur `IdleDetector` n'est pas retenue comme dépendance : elle est
expérimentale, permissionnée et sa disponibilité n'est pas suffisante pour la
cible Safari/Firefox. `visibilitychange` et `requestIdleCallback` ont des rôles
différents et ne fournissent pas cette sémantique.

## Contrat

- `idle` est configurable dans `CodPlayEngineOptions` et dans
  `CodPlayInstanceOptions`.
- Une configuration d'instance définie remplace la configuration par défaut de
  l'engine pour cette instance.
- Si `idle` est omis, il est actif avec `durationMs: 30_000`.
- Si `idle` vaut `false`, aucun idle n'est installé.
- L'event associé est `{ name: 'sequence:end' }` par défaut. `endSequence` est
  le terme fonctionnel ; le nom d'event existant dans les contrats V1/V2 est
  `sequence:end`.
- La configuration peut remplacer la durée et le descripteur de l'event. Le
  descripteur conserve la forme event du runtime (`name`, `data`, `visibility`)
  et porte `storyId` lorsque la visibilité vaut `story`.
- L'inactivité est mesurée par les frames acceptées par l'engine pendant que le
  player est en `playing`. Elle n'utilise pas `setTimeout` et reste donc alignée
  sur l'horloge externe ou le ticker de l'engine.
- Une émission externe acceptée par le player réinitialise la période
  d'inactivité. Les eventimes simplement ancrés dans le journal ne sont pas
  rejoués par le monitor au moment de leur échéance et ne constituent donc pas
  un signal d'activité.
- La pause suspend le comptage ; la reprise repart sur une nouvelle période.
  Un `seek` réinitialise également la période.
- Une période d'inactivité ne produit qu'un event. Une nouvelle période peut
  être détectée après une émission externe ou une reprise.

## Circuit d'exécution

Le monitor est créé pour chaque `RuntimePlayer`. L'engine ne fait que porter la
configuration par défaut ; il ne crée ni timer parallèle ni journal parallèle.
Quand une frame franchit le seuil, le player appelle son `emitEvent` existant,
avec l'event idle et le temps courant. L'event est ainsi journalisé et passe par
`listen -> straps -> emit` comme toute autre émission runtime.

## Validation

La tranche doit couvrir au minimum :

- seuil par défaut et event `sequence:end` ;
- seuil et event personnalisés ;
- surcharge player de la configuration engine ;
- `idle: false` ;
- reset par émission, pause/reprise et seek ;
- diagnostic d'un paramètre invalide ;
- typecheck et suite complète `codplay`.

Validation exécutée le 2026-08-29 :

- `tests/runtime/idle/runtime-idle.spec.ts` et `tests/facade/idle-config.spec.ts` : 10 tests passés ;
- `npm test --workspace=codplay` : 80 fichiers, 506 tests passés ;
- `npm run typecheck --workspace=codplay` : succès ;
- `git diff --check` : succès.
