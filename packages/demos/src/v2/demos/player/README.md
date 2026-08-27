# Démo de validation preload-media V2

> Status: En cours — validation locale
> CodPlay version: V2 foundation

Cette source de validation présente l'adaptation V2 de la démo `preload-media`.
Elle a été déplacée sous l'arborescence des démos V2 ; son adaptation au layout
commun et son entrée de registre restent à faire. Elle vérifie le chemin réel :

```text
manifeste explicite -> preload externe -> runner.init() -> telco.play()
                                      -> media-sync / master
```

La scène démarre après le preload. Elle présente un media audio marqué
`initial.master: true`, une vidéo, deux images et la feuille de style de la
scène. La scène se termine à `6890 ms`, à la fin de la fenêtre de diffusion de
la vidéo (`1000 ms` de départ + `5890 ms`). La telco est la façade locale `RuntimeTelco` utilisée par les autres
validations V2 ; elle permet de lire, pauser, revenir au début et seek en
continu.

Les éléments de la scène ciblent l'`outlet` public du layout V2. La démo ne
invente pas de cibles `cell-*` qui ne seraient pas déclarées par le composant.

La démo ne possède aucun catalogue, composant ou runtime parallèle. Elle ne
importe pas de code d'exécution V1 : les fichiers médias réutilisés sont
uniquement des assets de démonstration.

## Vérification

Le build de scène est refusé avant le preload si le contrat V2 est invalide.
Le résultat attendu est un preload terminé, puis une lecture lancée par le
bouton `Lire`, où le media `master` fournit l'horloge quand sa clock native est
disponible ; sinon le ticker CodPlay prend le relais.

La vérification couvre aussi le seek arrière après la fin native du master :
les broadcasts actifs sont rejoués et le master revient à la position demandée
sans recharger sa source.

Anomalie connue à traiter : sur Safari, la vidéo peut rester noire alors que le
transport et les contrôles natifs indiquent la lecture. La cause reste ouverte ;
la validation visuelle de cette démo n'est donc pas clôturée.
