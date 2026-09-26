# Rationale — `context.live` et les occurrences planifiées

## Rôle

Cette note conserve la raison pour laquelle le helper V1 `context.live` n'est
pas repris tel quel. Elle ne définit pas de nouvelle API ; les contrats vérifiés
et les décisions restantes sont dans les spécifications et plans cités plus
bas.

## Motif de séparation

Un callback exécuté à chaque frame fait dépendre ses sorties de la cadence de
l'affichage. Le seek et le replay reconstruisent au contraire un état à partir
du temps logique et des faits inscrits au journal. Une valeur pure calculable à
un instant et une suite finie d'événements répondent donc à deux besoins
différents : la première relève des actions temporelles, la seconde des
occurrences planifiées et du dispatcher commun.

Un cycle dépendant d'un état qui change pendant la lecture n'est pas résolu par
la seule existence d'un helper temporel ou d'une primitive ACE. Il reste une
question d'extension, sans contrat `live` accepté à ce jour.

## Documents de référence

- Les helpers planifiés vérifiés et leurs limites :
  [spécification straps](../../specs/strap-execution-v2-spec.md) et
  [plan d'acceptation](../strap-execution-plan.md).
- Les valeurs temporelles auteur et les expositions encore à décider :
  [spécification ActionSequence/TweenAction](../../specs/action-sequence-tween-v2-spec.md)
  et [plan d'acceptation](../action-sequence-tween-plan.md).
