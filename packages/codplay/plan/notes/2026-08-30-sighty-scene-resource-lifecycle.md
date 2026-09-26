# Rationale — cycle de vie des occurrences Sighty et CodPlay

## Rôle

Cette note conserve la frontière de propriété entre CodPlay et son consommateur
Sighty ; elle ne crée pas de contrat pour l'un ou l'autre. Sighty consomme
désormais la façade publique CodPlay. Son comportement et ses validations sont suivis par
sa [spécification](../../../sighty/specs/authoring-library-spec.md) et son
[plan actif](../../../sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md).

## Frontière de propriété

Une fin de lecture n'entraîne pas à elle seule la destruction d'une occurrence.
L'hôte décide si elle est conservée ou démontée ; CodPlay reste propriétaire de
l'instance, de son player et de son teardown. Le montage `slot` attache des
racines matérialisées et ne pilote pas le player enfant. Ces responsabilités
correspondent aux surfaces décrites par les spécifications CodPlay de
[façade](../../specs/facade-v2-spec.md) et de
[slot](../../specs/slot-component-spec.md).

Le preload distingue le canal CSS par slot des ressources partagées par URL.
La [spécification preload](../../specs/preload-v2-spec.md) certifie le compteur
de références du cache partagé, la libération d'une lease vidéo avant adoption
et le nettoyage des slots CSS. Le nettoyage complet des handles après adoption
reste au [plan média CodPlay](../../plan/media-preload-plan.md). L'identité d'un
slot propre à une occurrence Sighty, l'ordre de son nettoyage avec la libération
des URLs et les échecs de teardown relèvent de l'acceptation Sighty ; cette note
ne les présente pas comme un comportement CodPlay vérifié.
