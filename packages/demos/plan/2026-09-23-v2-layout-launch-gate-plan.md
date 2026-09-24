# Verrou d'entrée avant le premier Play — layout V2

## Statut

- Décision : **Fixe** selon la demande du 2026-09-23 : aucune interaction
  utilisateur avec la scène avant son lancement.
- Implémentation : **En cours** jusqu'à validation dans le navigateur.

## Périmètre et frontière

Le layout partagé maintient la scène `inert` depuis le montage jusqu'au premier
état `playing` signalé par la telco publique. Il retire ensuite le verrou pour
le reste de ce montage, y compris pendant une pause ou un repositionnement.
Un rechargement remonte une instance et réarme le verrou.

Le verrou couvre les entrées utilisateur dans le DOM de la scène. Les eventimes
du module d'initialisation continuent de passer par `instance.events.emit()` en
état `ready`, car ils restaurent l'état avant le lancement. Le runtime n'est
pas la frontière à modifier : le layout possède déjà l'hôte DOM et la telco,
tandis que la capture continue V2 ne spécifie pas une interdiction générale
d'émission avant `play()`.

## Travaux

1. Réarmer `inert` au montage et au démontage de la scène.
2. Observer le premier état `playing` avec `telco.onChange`, puis libérer la
   scène jusqu'au démontage.
3. Valider le pointeur, le clavier, le premier Play, la pause et le rechargement
   dans le vrai layout V2.

## Acceptation

- Avant Play, la scène ne reçoit pas d'interaction pointeur ou clavier et ses
  contrôles ne peuvent pas prendre le focus.
- La télécommande et les eventimes de restauration fonctionnent avant Play.
- Le premier Play rend la scène interactive ; pause et seek ne réarment pas le
  verrou.
- Le rechargement rend la nouvelle scène `inert` jusqu'à son premier Play.
- Le plan reste **En cours** jusqu'à cette validation navigateur.
