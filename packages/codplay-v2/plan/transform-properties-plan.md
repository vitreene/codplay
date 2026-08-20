# CodPlay V2 - contrat des proprietes de transformation

## Statut

> Status: Fixe pour la tranche ACE scalaires et materializer HTML
> CodPlay version: V2 foundation
> Review: tranche ACE/HTML validée le 2026-08-20; les séquences CSS brutes sont conservées par le materializer sans décomposition

Cette partie est prioritaire sur la couverture complete des autres proprietes des
scenes S1-S4. Elle precede le catalogue des defaults par propriete, car un default
de transformation n'a de sens qu'apres la definition de la representation interne
et de son ordre de composition.

## References

AnimeJS 4.5 est consulte comme source d'observation et de comparaison, sans devenir
une dependance ni une source normative du contrat V2 :

- `x`, `y` et `z` sont des aliases de `translateX`, `translateY` et `translateZ`;
- les canaux reconnus incluent `translateX/Y/Z`, `rotate`, `rotateX/Y/Z`,
  `scale`, `scaleX/Y/Z`, `skew`, `skewX/Y` et `perspective`;
- les canaux transform sont traites comme une famille distincte des proprietes CSS;
- l'interpreteur maintient les canaux separement avant de produire une representation
  composee.

Anime compose ses canaux dans cet ordre : `perspective`, `translateX/Y/Z`, `rotate`,
`rotateX/Y/Z`, `scale`, `scaleX/Y/Z`, `skew`, `skewX/Y`, puis les matrices
preservees. `rotate3d` est preserve entre les rotations et le scale. Les formes
`translate(...)`, `translate3d(...)`, `scale(...)` et `scale3d(...)` sont decoupees
en canaux lorsqu'elles sont lues depuis une transform inline. Une matrix n'est pas
decomposee en canaux : elle reste une operation distincte en fin de composition.

Ces observations ne signifient pas que V2 reutilise le runtime AnimeJS, son code ou
ses decisions de projection. Elles servent uniquement a comparer les formes et les
cas limites avant de definir un contrat V2 independant.

## Frontieres

Le travail est separe en trois etages :

1. entree auteur : aliases et formes acceptees;
2. contrat interne V2 : canaux, unites, valeurs et ordre;
3. projection : composition vers le substrat du composant.

Les formes auteur sont séparées par la frontière qui les reçoit :

- les canaux scalaires (`x`, `translateX`, `rotate`, `scale`, etc.) sont normalisés
  puis composés dans l'ordre canonique V2 ;
- les propriétés CSS individuelles comme `translate` restent des déclarations
  séparées du materializer HTML ; elles ne sont pas décomposées en canaux ACE ;
- `transform: ...` est une séquence auteur opaque. Elle est conservée dans son
  ordre, y compris un `matrix(...)` placé au milieu ; elle peut être ajoutée après
  la séquence des canaux scalaires lorsque les deux formes coexistent.

La matrix utilisée par une présentation transitoire est un slot interne du
materializer. Elle ne remplace pas l'état auteur et ne devient ni une valeur
compilée ni une source de lecture du composant.

## Invariants a fixer

- L'ordre des operations est preserve; `translate` puis `rotate` n'est pas equivalent
  a `rotate` puis `translate`.
- Un alias ne cree pas un nouveau canal : `x` et `translateX` visent la meme valeur
  interne.
- Les defaults d'identite sont attaches aux canaux, pas aux textes CSS : translation
  nulle, rotation nulle, scale unitaire, skew nul lorsque ces canaux sont declares.
- Une identite de translation est polymorphe par unite : `0` ne doit pas etre envoye
  directement a ACE face a `50%`. Sa materialisation doit produire une borne de meme
  unite que l'intervalle, sans convertir la valeur vers le substrat.
- Une matrix n'est jamais inventee a partir d'une valeur absente.
- ACE recoit une representation interne complete et un `from` deterministe; il ne
  lit ni DOM, ni style calcule, ni transform precedente du substrat.
- Une composition partielle ne doit pas effacer les autres canaux deja resolus.
- L'ordre de composition est une donnee du contrat, pas un detail du materializer.
- Un `transform` brut n'est jamais parsé ou réordonné par le materializer.
- Une valeur numérique de longueur n'est convertie en `px` qu'à la frontière HTML.
- Le facteur d'échelle de cette conversion appartient au contexte runtime du
  materializer, jamais à `CompiledScene` ou à l'état logique.

## Familles AnimeJS observees pour le style CSS

Pour cette tranche, l'observation porte uniquement sur les proprietes de style CSS
pertinentes. Les familles de cible runtime suivantes ne deviennent pas des contrats
de compilation V2 :

- `TRANSFORM` pour les canaux de transformation;
- les proprietes CSS ordinaires;
- les variables CSS lorsqu'elles sont explicitement declarees par un service.

Les attributs SVG, les proprietes d'objets et les adapters runtime sont hors de la
tranche compilee. Ils pourront avoir leurs propres contrats plus tard, mais ne
doivent pas influencer les defaults CSS actuels.

La classification des valeurs reste independante : AnimeJS distingue `NUMBER`,
`UNIT`, `COLOR` et `COMPLEX`. V2 peut consulter cette decomposition lorsqu'elle est
portable, avec la regle specifique des unites documentee dans
[`unit-values-plan.md`](./unit-values-plan.md).

Les valeurs relatives (`+=`, `-=`, `*=`), les fonctions et les adapters sont des
etapes de preparation supplementaires; ce ne sont pas des defaults de propriete.

## Etapes

1. Comparer les aliases et les formes AnimeJS avec les formes effectivement utiles a CodPlay.
2. Definir la representation interne ordonnee et les unites auteur.
3. Implementer la normalisation pure et ses diagnostics. La premiere tranche
   normalise les noms et l'ordre; elle ne parse pas les valeurs ni les unites.
4. Declarer les defaults d'identite et la resolution de `from`, y compris la
   materialisation d'une identite dans l'unite deja portee par l'intervalle.
5. Tester les aliases, l'absence de faux axes implicites, les ordres différents,
   les compositions partielles et la coexistence avec une séquence brute contenant
   une matrix.
6. Relier cette représentation aux services du materializer et au contexte runtime
   de conversion HTML.

Le catalogue des autres defaults reste hors de cette partie tant que cette frontiere
n'est pas relue.

La premiere integration ACE est limitee aux tweens scalaires de canaux transform.
Pour ACE, la resolution de `from` est volontairement binaire : borne resolue, ou
preparation differee demandee a l'etat logique/runtime. Le builder peut conserver
la provenance plus fine (auteur ou identite) pour appliquer la hierarchie des
defaults et produire ses diagnostics, mais cette provenance ne fait pas partie de
l'API ACE. ACE ne prepare jamais une transition differee tant que la borne n'est
pas fournie; il ne lit ni le DOM ni une valeur implicite du substrat.

## Integration runner realisee

La tranche HTML runner relie les aliases auteur `style.x`, `style.y` et `style.z`,
ainsi que les canaux transform scalaires canoniques, à la préparation ACE. La
résolution logique produit une valeur scalaire à chaque instant; le service DOM
compose les canaux dans l'ordre contractuel. Il conserve `translate(x, y)` lorsque
les deux axes sont présents, mais produit `translateX(...)` ou `translateY(...)`
lorsqu'un seul axe est déclaré : aucun axe nul n'est inventé.

La chaîne `style.transform` est gardée séparément et ajoutée sans parsing après les
canaux scalaires. Les matrices et l'ordre internes à cette chaîne restent donc ceux
de l'auteur. Les propriétés CSS individuelles restent des déclarations séparées.
Les unités portées par les chaînes sont conservées; les valeurs numériques des
longueurs reçoivent `px` à la frontière HTML, après application du
`numericLengthScale` fourni par `HtmlMaterializerRuntimeContext`.

`HtmlPlayerRunner.resize()` réapplique la frame logique courante après la mise à
jour de ce contexte. Il ne recompile ni ne rejoue la timeline.
