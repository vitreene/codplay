# Démo de validation capture / list DnD V2

> Status: En cours — consignée pour publication ultérieure
> CodPlay version: V2 foundation

Cette démo est conservée comme fixture de validation V2. Elle n'est pas
encore publiée dans la galerie ou le site de démonstration public.
La validation du seek reste ouverte avant le passage à `Fini`.

Cette entrée unique de validation remplace la démo capture précédente par
une scène S6 déclarée directement avec les contrats V2 :

```text
pointerdown -> beginCapture
pointermove  -> trackCapture -> preview HTML transitoire
pointerup    -> résolution finale du captureState -> endEmit
             -> action move ordinaire -> list / StructuralTimeline / FLIP
```

La lecture, le seek et le retour au début passent par la telco V2 locale et son
remote de contrôle. La zone de telco est placée sous la scène ; le relevé d'état
affiche l'ordre des deux listes. Le layout reste responsive.

Le remote partagé est une façade de validation temporaire (`temp`) ; il
consomme uniquement `RuntimeTelco`. Il ne constitue pas une seconde façade
Player. Aucun module, type ou runtime d'une autre version n'est importé par
cette démo.

Pour tester :

1. lancer la démo ;
2. cliquer sur `Lire` : le verrou d'interaction de la scène s'ouvre alors ;
3. déplacer un item de la liste A vers la liste B ;
4. mettre en pause ou utiliser le seek pour observer la reconstruction de
   l'ordre et des compteurs.

Le `rate` et le transport distant restent hors de cette tranche V2. La façade
DnD auteur dédiée reste reportée : cette démo valide d'abord une capture
classique.

Le typecheck, les tests Vitest et le build Vite sont suivis par le plan
d'intégration. Toute publication ultérieure doit reprendre cette entrée unique
et son circuit V2, sans créer une variante parallèle.

Lancer depuis la racine :

```text
npm run demo:player --workspace=@codplay/codplay-v2
```
