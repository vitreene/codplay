# Démo preload média

> Statut : En cours
> Version CodPlay : V2 foundation

Cette démo transpose la scène V1 `preload-media` dans le runtime V2. Elle
présente une source audio dès le début, une vidéo après deux secondes, puis
deux images après quatre et cinq secondes.

Les sources média et image sont déduites du `SceneDoc` par le builder, puis
chargées par `codplay.preload` avant la création de l'instance. La feuille de
style de la démo est également chargée par le layout commun.

La démo est accessible avec :

```text
http://localhost:5173/v2.html?demo=preload-media
```
