# Démo de validation preload-media V2

> Status: En cours — validation locale via le registry V2
> CodPlay version: V2 foundation

Cette source de validation présente l'adaptation V2 de la démo `preload-media`.
Elle est chargée par l'entrée `player` du registry et fournit uniquement une
scène, sa feuille de style et son manifest de ressources. Le layout commun
branche ensuite l'engine, le player, le runner et la télécommande publique. Elle
vérifie le chemin réel :

```text
registry -> manifest explicite -> preload externe -> instance publique -> telco.play()
                                      -> media-sync / master
```

La scène démarre après le preload. Elle présente un media audio marqué
`initial.master: true`, une vidéo, deux images et la feuille de style de la
scène. La scène se termine à `6890 ms`, à la fin de la fenêtre de diffusion de
la vidéo (`1000 ms` de départ + `5890 ms`). La telco est la façade commune
utilisée par les autres validations V2 ; elle permet de lire, pauser, revenir au
début et seek en continu. Le preload enregistre ses URLs et métadonnées auprès
de l'engine avant la création de l'instance.

Les éléments de la scène ciblent l'`outlet` public du layout V2. La démo ne
invente pas de cibles `cell-*` qui ne seraient pas déclarées par le composant.

La démo ne possède aucun catalogue, composant ou runtime parallèle. Elle ne
importe pas de code d'exécution V1 : les fichiers médias réutilisés sont
uniquement des assets de démonstration.

## Vérification

Le build de scène est refusé avant le preload si le contrat V2 est invalide.
Le résultat attendu est un preload terminé, puis une lecture lancée par le
bouton `Lire` de la télécommande commune, où le media `master` fournit l'horloge
quand sa clock native est disponible ; sinon le ticker CodPlay prend le relais.

La vérification couvre aussi le seek arrière après la fin native du master :
les broadcasts actifs sont rejoués et le master revient à la position demandée
sans recharger sa source.

Anomalie connue à traiter : sur Safari, la vidéo peut rester noire alors que le
transport et les contrôles natifs indiquent la lecture. La cause reste ouverte ;
la validation visuelle de cette démo n'est donc pas clôturée.
