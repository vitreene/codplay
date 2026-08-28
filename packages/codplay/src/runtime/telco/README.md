# Telco V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La telco est la façade locale qui permet à une interface de piloter un player
V2. Elle transforme des commandes de transport en appels vers un player déjà
initialisé et expose son état sous une forme observable et sérialisable.

## Fonctionnement

Les commandes prises en charge sont `play`, `pause`, `seek`, `rewind` et le
changement de vitesse. La telco sérialise les commandes de transport, transmet
les opérations à la cible et publie les instantanés d'état ainsi que la
progression.

## Organisation interne

`RuntimeTelco` reçoit une cible de transport déjà initialisée. Il ne connaît ni
le runner, ni le catalogue, ni le materializer. La façade d'instance l'expose
comme `instance.telco`, sans créer une seconde cible de commande.

## Interaction du progress

- `pointerdown` ouvre l'interaction et met en pause une lecture active via la
  telco ;
- les valeurs intermédiaires sont coalescées et envoyées au même circuit de
  commande ;
- la valeur courante reste affichée pendant le glissement, même si la commande
  précédente est encore en cours ;
- au relâchement, la dernière valeur est envoyée une seule fois, malgré les
  événements `change`, `pointerup`, `lostpointercapture` ou `blur` qui peuvent
  se cumuler ;
- la sérialisation des commandes appartient à `RuntimeTelco`, pas au remote.

Le remote ne pilote donc jamais directement `HtmlPlayerRunner` et ne crée pas
de second chemin pour `play`, `pause` ou `seek`.

## Contrat et limites

- la telco ne contient ni logique de scène, ni recherche de cibles, ni
  materialization ;
- elle n'implémente pas de transport distant ;
- `rate` est transmis par la même façade et ne modifie pas la position logique ;
- elle est utilisable par tout consommateur V2 qui a besoin d'un transport.
