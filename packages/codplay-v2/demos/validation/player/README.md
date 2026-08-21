# Démo de validation capture V2

> Status: Fini
> CodPlay version: V2 foundation

Cette entrée unique de validation reprend le scénario `S5 Drag & Capture` de
V1 avec le circuit V2 :

```text
pointerdown -> beginCapture
pointermove  -> trackCapture -> action capture_draggable_move -> Component.update()
pointerup    -> endCapture -> événement drag:dropped -> journal / state
```

La lecture, le seek et le retour au début passent par la telco V2 locale et son
remote de contrôle. Aucun bouton de démo séparé ne pilote directement le
runner, et aucun circuit `list-dnd` n'est porté dans cette validation.
La zone de telco est placée sous la scène ; le relevé d'état est le dernier
panneau de la page. Le layout reste responsive.

Le remote partagé est une façade de validation temporaire (`temp`) ; il
consomme uniquement `RuntimeTelco`. Il ne constitue pas une seconde façade
Player et n'importe pas le remote V1.

Pour tester :

1. lancer la démo ;
2. cliquer sur `Lire` : le verrou d'interaction de la scène s'ouvre alors ;
3. déplacer le bouton dans la scène ;
4. mettre en pause ou utiliser le seek pour observer la relecture de
   `drag:dropped`.

Le `rate` et le transport distant restent hors de cette tranche V2.

Lancer depuis la racine :

```text
npm run demo:player --workspace=@codplay/codplay-v2
```
