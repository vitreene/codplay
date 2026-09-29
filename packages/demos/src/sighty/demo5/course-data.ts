import { COURSE_EVENTS } from './messages'

/** Identifies one of the three chapters shown in the course menu. */
export type CourseChapterId = 'chapter-1' | 'chapter-2' | 'chapter-final'

/** Describes one question option without coupling the course to another demo. */
export type CourseAnswer = Readonly<{
  id: string
  label: string
}>

/** Describes one authored paragraph, with an optional local demo asset. */
export type CourseSection = Readonly<{
  heading: string
  paragraph: string
  image?: Readonly<{ src: string; alt: string }>
  video?: Readonly<{ src: string; title: string }>
}>

/** Describes one single-answer quiz page in the Sighty course. */
export type CourseQuestion = Readonly<{
  type: 'boolean' | 'single' | 'multiple'
  prompt: string
  answers: readonly CourseAnswer[]
  correctAnswerIds: readonly string[]
}>

/** Describes one content page, quiz page, or terminal course result. */
export type CoursePage = Readonly<{
  id: string
  chapterId: CourseChapterId
  title: string
  menuVisible?: boolean
  kind: 'content' | 'quiz' | 'conclusion'
  sections?: readonly CourseSection[]
  question?: CourseQuestion
}>

/** Lists the chapter headings independently from their page definitions. */
export const COURSE_CHAPTERS: readonly Readonly<{
  id: CourseChapterId
  title: string
}>[] = [
  { id: 'chapter-1', title: '1. Lire une scène' },
  { id: 'chapter-2', title: '2. Observer les détails' },
  { id: 'chapter-final', title: '3. Évaluation finale' },
]

/** Holds page completion and quiz results projected through context.signet. */
export type CourseSignet = Readonly<{
  finishedPages: Readonly<Record<string, true>>
  chapter1QuizPassed: boolean
  finalAnswers: Readonly<Record<string, boolean>>
}>

/** Supplies the initial progress value for a fresh course session. */
export function createInitialCourseSignet(): CourseSignet {
  return { finishedPages: {}, chapter1QuizPassed: false, finalAnswers: {} }
}

/** Returns the course page document for one stable page identifier. */
export function getCoursePage(pageId: string): CoursePage | undefined {
  return COURSE_PAGES.find((page) => page.id === pageId)
}

/** Formats the absolute Sighty route for one page in the content slot. */
export function getCoursePagePath(pageId: string): string {
  const page = getCoursePage(pageId)
  if (page === undefined) {
    throw new Error(`La page de cours ${pageId} n’existe pas.`)
  }
  return `view-main/view-course/${page.chapterId}/slot-content/${pageId}`
}

/** Returns the menu pages for a chapter, excluding the hidden success screen. */
export function getMenuPages(chapterId: CourseChapterId): readonly CoursePage[] {
  return COURSE_PAGES.filter((page) => page.chapterId === chapterId && page.menuVisible !== false)
}

/** Returns the course page data associated with one scene key. */
export function getCoursePageBySceneKey(sceneKey: string | undefined): CoursePage | undefined {
  if (sceneKey === undefined || !sceneKey.startsWith('scene-')) return undefined
  return getCoursePage(sceneKey.slice('scene-'.length))
}

/** Creates the CodPlay scene key associated with one course page. */
export function getCourseSceneKey(pageId: string): `scene-${string}` {
  return `scene-${pageId}`
}

/** Determines whether one course page may be entered from the current signet. */
export function canAccessCoursePage(pageId: string, signet: CourseSignet): boolean {
  const page = getCoursePage(pageId)
  if (page === undefined) return false
  if (page.kind === 'conclusion') return hasPassedFinalAssessment(signet)

  const chapterPages = getMenuPages(page.chapterId)
  const pageIndex = chapterPages.findIndex((candidate) => candidate.id === page.id)
  if (pageIndex < 0) return false

  if (page.chapterId === 'chapter-1') {
    return pageIndex === 0 || signet.finishedPages[chapterPages[pageIndex - 1]!.id] === true
  }

  if (page.chapterId === 'chapter-2') {
    if (pageIndex === 0) return signet.chapter1QuizPassed
    return signet.finishedPages[chapterPages[pageIndex - 1]!.id] === true
  }

  if (pageIndex === 0) {
    return signet.finishedPages['chapter-2-synthesis'] === true
  }

  const previousQuestion = chapterPages[pageIndex - 1]
  return previousQuestion !== undefined
    && Object.hasOwn(signet.finalAnswers, previousQuestion.id)
}

/** Decides whether Sighty may leave one active page for a requested course event. */
export function canExitCoursePage(pageId: string, eventName: string | undefined, signet: CourseSignet): boolean {
  if (eventName === COURSE_EVENTS.previous) return pageId !== COURSE_START_PAGE_ID
  if (eventName === undefined || eventName.startsWith(COURSE_EVENTS.menuPrefix)) return true
  if (eventName !== COURSE_EVENTS.next) return true
  const page = getCoursePage(pageId)
  if (page === undefined || page.kind === 'conclusion') return false
  if (page.chapterId === 'chapter-final' && page.kind === 'quiz') {
    return Object.hasOwn(signet.finalAnswers, page.id)
  }
  if (signet.finishedPages[pageId] !== true) return false
  return page.chapterId !== 'chapter-1' || page.kind !== 'quiz' || signet.chapter1QuizPassed
}
/** Evaluates the accepted requirement of three correct final answers. */
export function hasPassedFinalAssessment(signet: CourseSignet): boolean {
  return COURSE_FINAL_QUESTION_IDS.every((pageId) => signet.finalAnswers[pageId] === true)
}

/** Builds a fresh signet with one page recorded as read to its bottom. */
export function markCoursePageFinished(signet: CourseSignet, pageId: string): CourseSignet {
  return {
    ...signet,
    finishedPages: { ...signet.finishedPages, [pageId]: true },
  }
}

/** Replaces one quiz result and derives the current final score from all answers. */
export function recordCourseQuizAnswer(
  signet: CourseSignet,
  page: CoursePage,
  isCorrect: boolean,
): CourseSignet {
  if (page.kind !== 'quiz') return signet

  if (page.chapterId === 'chapter-1') {
    return { ...signet, chapter1QuizPassed: isCorrect }
  }

  return {
    ...signet,
    finalAnswers: { ...signet.finalAnswers, [page.id]: isCorrect },
  }
}

/** Returns a validated signet record or the empty progress shape. */
export function readCourseSignet(value: unknown): CourseSignet {
  if (typeof value !== 'object' || value === null) return createInitialCourseSignet()
  const candidate = value as Partial<CourseSignet>
  return {
    finishedPages: isTrueRecord(candidate.finishedPages)
      ? candidate.finishedPages as Readonly<Record<string, true>>
      : {},
    chapter1QuizPassed: candidate.chapter1QuizPassed === true,
    finalAnswers: isBooleanRecord(candidate.finalAnswers)
      ? candidate.finalAnswers as Readonly<Record<string, boolean>>
      : {},
  }
}

/** Checks whether every value in a JSON-style record is boolean. */
function isBooleanRecord(value: unknown): value is Readonly<Record<string, boolean>> {
  return typeof value === 'object'
    && value !== null
    && Object.values(value).every((entry) => typeof entry === 'boolean')
}

/** Checks that every completion entry is explicitly recorded as finished. */
function isTrueRecord(value: unknown): value is Readonly<Record<string, true>> {
  return typeof value === 'object'
    && value !== null
    && Object.values(value).every((entry) => entry === true)
}

/** Defines the course page content, questions, and final result. */
export const COURSE_PAGES: readonly CoursePage[] = [
  {
    id: 'chapter-1-intro',
    chapterId: 'chapter-1',
    kind: 'content',
    title: 'Repérer les grandes formes',
    sections: [
      {
        heading: 'Un premier regard',
        paragraph: `Une scène se lit d’abord dans son ensemble. Les grandes lignes, les contrastes et les zones de lumière donnent des repères avant même que l’on observe les petits détails. Prenez quelques secondes pour regarder toute l’image sans choisir tout de suite un point précis. Demandez-vous où se trouvent les masses principales, quelle zone attire spontanément l’œil et comment les différentes parties occupent l’espace. Parcourez ensuite le cadre d’un bord à l’autre : repérez une forme claire, une forme sombre, puis l’espace qui les sépare. Essayez de garder en mémoire votre première impression avant de chercher à l’expliquer. Est-elle liée à un contraste, à une direction ou à un élément placé près du centre ? Revenez enfin sur les zones qui vous avaient semblé secondaires. Un détail discret peut modifier la lecture de l’ensemble ou confirmer votre première hypothèse. Pour décrire ce regard à une autre personne, nommez des éléments qu’elle peut retrouver dans l’image et indiquez leur emplacement. Cette première étape ne demande pas encore d’interpréter la scène ; elle sert à établir des repères communs et à choisir où porter ensuite une attention plus précise.`,
        image: { src: '/assets/35c8ec5a07fc.jpg', alt: 'Relief éclairé au bord d’une vallée' },
      },
      {
        heading: 'La ligne d’horizon',
        paragraph: `L’horizon sépare les plans et aide à comprendre la place du ciel. Sa hauteur dans l’image change l’impression d’espace et la façon dont le regard circule. Comparez sa position avec le milieu du cadre : un horizon bas laisse davantage de place au ciel, tandis qu’un horizon haut met l’accent sur le terrain. Repérez aussi les endroits où la ligne devient difficile à suivre. Elle peut disparaître derrière une crête, se confondre avec une bande de brume ou être interrompue par un bâtiment. Ne prenez pas chaque ligne horizontale pour l’horizon : une route, une rive ou une succession d’arbres peut traverser l’image sans marquer la limite du ciel. Cherchez plutôt où les surfaces se rejoignent et vérifiez si cette limite reste cohérente d’un côté à l’autre. Vous pouvez comparer sa hauteur aux éléments proches, puis regarder si les pentes semblent monter vers elle ou s’en éloigner. Décrire ces indices permet de parler de la profondeur sans supposer immédiatement où se trouve l’observateur. Dans une phrase, indiquez si l’horizon est haut, bas ou peu visible, puis précisez ce qui vous conduit à cette description.`,
      },
      {
        heading: 'Les formes dominantes',
        paragraph: `Une pente, une crête ou une trouée forment des directions faciles à suivre. Repérer ces formes simples permet de décrire la composition sans chercher tout de suite une interprétation. Suivez leur contour avec les yeux et remarquez les lignes qui se répondent ou se croisent. Vous pouvez les nommer avec des mots concrets, puis indiquer dans quelle partie de l’image elles apparaissent. Une pente peut occuper tout un côté du cadre, alors qu’une trouée ouvre un passage entre deux masses. Observez si ces formes sont continues ou découpées par des arbres, des rochers ou des ombres. Une même crête peut guider le regard vers le centre, puis l’entraîner vers un bord ; notez les changements de direction plutôt que de la résumer par un seul mot. Regardez aussi les espaces laissés entre les formes. Ils dessinent parfois une silhouette aussi reconnaissable que les éléments eux-mêmes. Pour faire une description vérifiable, distinguez la forme que vous voyez de l’effet qu’elle produit : « une pente diagonale monte depuis le coin inférieur » décrit un indice, tandis que « elle donne une impression de mouvement » formule une interprétation. Les deux peuvent être utiles si vous les présentez dans cet ordre.`,
        image: { src: '/assets/28970388742_2f75d527d6_z.jpg', alt: 'Sentier qui dessine une ligne dans le paysage' },
      },
      {
        heading: 'Prendre son temps',
        paragraph: `Une observation attentive commence par une pause. On peut ensuite nommer ce qui attire le regard, puis vérifier si d’autres éléments confirment cette première impression. Revenez une seconde fois sur les zones moins visibles et comparez-les au point qui vous a frappé au départ. Ce détour évite de confondre une impression rapide avec une description complète de la scène. Pour cette seconde lecture, choisissez une autre direction : partez d’un bord, suivez une ligne jusqu’à son extrémité, puis regardez ce qui se trouve autour. Vous pouvez aussi comparer une zone chargée de détails à une surface plus calme. Demandez-vous si la première impression reste valable ou si un nouvel élément la nuance. Il n’est pas nécessaire de tout retenir ; deux ou trois repères bien situés sont souvent plus utiles qu’une longue liste. Prenez le temps de vérifier les mots employés : « grand », « proche » ou « lumineux » ont-ils un point de comparaison clair ? Une pause aide à séparer ce qui est immédiatement visible de ce que l’on imagine. Elle permet ensuite de partager une description plus précise, que quelqu’un d’autre peut confronter à la même image et compléter avec ses propres observations.`,
      },
    ],
  },
  {
    id: 'chapter-1-plans',
    chapterId: 'chapter-1',
    kind: 'content',
    title: 'Distinguer les plans',
    sections: [
      {
        heading: 'Le premier plan',
        paragraph: `Les éléments proches paraissent souvent plus nets et plus grands. Ils donnent une échelle au reste de la scène et peuvent guider le regard vers le centre. Cherchez un objet, une plante ou une portion de chemin dont la forme reste précise. Notez sa taille apparente et sa place dans le cadre : ces indices aident à le distinguer de ce qui se trouve derrière lui. Regardez si une partie de cet élément masque le terrain ou un autre objet ; le recouvrement montre alors lequel se trouve devant. Comparez la précision de ses contours avec celle des formes voisines, sans conclure que la netteté indique toujours la distance : la lumière, le mouvement ou la mise au point peuvent aussi la modifier. Un élément situé près du bord inférieur peut sembler plus important simplement parce qu’il occupe une grande surface. Pour le décrire, associez sa position à un repère stable, par exemple « à gauche du chemin » ou « au premier plan, devant la pente ». Vous pouvez ensuite expliquer comment il sert d’échelle ou attire l’œil. Cette séparation entre la place observée et le rôle supposé rend la description plus facile à vérifier et évite de confondre la taille dans l’image avec la taille réelle de l’objet.`,
        image: { src: '/assets/28999069391_5893263112_z.jpg', alt: 'Détails végétaux au premier plan' },
      },
      {
        heading: 'Le plan intermédiaire',
        paragraph: `Au milieu de l’image, les chemins et les groupes d’arbres relient les éléments proches aux formes lointaines. Leur position donne une impression de profondeur. Un même élément peut commencer près du bord puis conduire vers le fond. Observez les recouvrements et les changements de taille : ils montrent comment les distances s’organisent, même lorsque les limites entre les plans restent discrètes. Une route peut s’élargir au premier plan et paraître se resserrer à mesure qu’elle s’éloigne. Des arbres de tailles différentes peuvent également former une suite qui aide à parcourir l’espace. Suivez un de ces repères jusqu’à l’endroit où il disparaît : passe-t-il derrière une colline, rejoint-il l’horizon ou sort-il du cadre ? Le plan intermédiaire ne se reconnaît pas toujours à un objet précis. Il peut être constitué de plusieurs surfaces qui font la transition entre le proche et le lointain. Regardez quelles formes se superposent, lesquelles restent visibles et si leur contraste change. Dans votre description, indiquez le trajet ou la relation entre les éléments, plutôt que de simplement les énumérer. Cette organisation aide à expliquer comment le regard passe d’une distance à l’autre.`,
      },
      {
        heading: 'L’arrière-plan',
        paragraph: `Les reliefs éloignés perdent parfois du contraste. Cette différence aide à les séparer du premier plan sans avoir besoin de tracer une limite visible. Comparez les contours, les couleurs et la précision des détails. Une crête lointaine peut sembler plus pâle et plus douce qu’un arbre proche. Décrivez ces écarts avant de décider ce qu’ils indiquent sur l’espace. Regardez si plusieurs indices vont dans le même sens : une forme plus petite, un recouvrement par les reliefs proches et des contours moins distincts suggèrent ensemble une grande distance. Une couleur pâle ne suffit pas à elle seule, car elle peut aussi résulter de l’éclairage ou d’une surface claire. Le fond peut contenir plusieurs couches : une première colline masque partiellement une ligne plus lointaine, puis une autre forme se détache encore derrière elle. Comparez leur hauteur et leur contraste pour distinguer ces niveaux. Le ciel peut offrir un repère, mais sa couleur change elle aussi selon les conditions. Pour rester précis, nommez d’abord les formes visibles et leur relation : « une crête plus claire apparaît derrière la pente sombre ». Vous pourrez ensuite expliquer pourquoi cette différence donne une impression de profondeur, en indiquant les indices plutôt qu’en présentant cette impression comme un fait certain.`,
      },
      {
        heading: 'Relier les distances',
        paragraph: `On peut décrire chaque plan séparément, puis observer comment une ligne, une couleur ou une ouverture les relie dans l’image. Essayez de suivre un chemin depuis le bord inférieur jusqu’à l’horizon, en nommant ce qui change à chaque étape. Cette progression transforme une liste d’objets en description de l’espace et rend le parcours visuel plus facile à expliquer. Commencez par un repère proche, puis cherchez l’élément qui prolonge sa direction. Il peut s’agir d’un chemin, d’une rangée de végétation ou d’une succession de formes qui se répètent. Notez le moment où la taille diminue, où les contours deviennent plus doux ou où un élément en masque un autre. Ces changements donnent des étapes au regard. Si le passage entre deux plans est difficile à localiser, décrivez ce que vous voyez plutôt que de forcer une frontière : une pente peut se prolonger sans rupture nette. Vous pouvez aussi expliquer qu’une couleur ou une ligne relie les deux zones. À la fin, reprenez votre parcours dans le même ordre et vérifiez que chaque élément possède un emplacement clair. Une autre personne devrait pouvoir retrouver le chemin que vous avez suivi. Cette méthode donne une structure spatiale à la description sans imposer une interprétation unique de la scène.`,
      },
    ],
  },
  {
    id: 'chapter-1-movement',
    chapterId: 'chapter-1',
    kind: 'content',
    title: 'Suivre le regard',
    sections: [
      {
        heading: 'Les directions',
        paragraph: `Les lignes d’un chemin, d’une rivière ou d’une pente suggèrent un parcours visuel. Le regard peut les suivre jusqu’à un point d’arrêt ou les quitter pour explorer un autre détail. Choisissez une ligne visible, suivez-la lentement et observez où elle conduit. Une courbe peut masquer sa destination, alors qu’une direction nette peut mener directement vers une crête ou un bâtiment. Décrivez son point de départ, sa direction et l’endroit où elle devient moins visible. Une ligne qui traverse l’image peut entraîner le regard vers le fond ; une autre peut le ramener vers un élément proche. Lorsque deux directions se croisent, demandez-vous laquelle est la plus facile à suivre et pourquoi : contraste plus marqué, position centrale ou continuité plus nette. Certaines lignes sont réelles, comme le bord d’un chemin ; d’autres sont suggérées par une rangée d’arbres ou par l’alignement de plusieurs rochers. Elles n’ont pas besoin d’être parfaitement droites pour guider l’attention. Repérez aussi les endroits où le parcours s’interrompt. Le regard peut alors s’arrêter, revenir en arrière ou bifurquer vers une autre forme. Pour comparer vos observations, suivez une ligne différente et voyez si elle conduit au même point. Le mouvement du regard devient ainsi un élément que l’on peut expliquer à partir de repères visibles.`,
        image: { src: '/assets/35c8ec5a07fc.jpg', alt: 'Les lignes d’un relief guident le regard' },
      },
      {
        heading: 'Les zones de contraste',
        paragraph: `Une zone claire entourée de tons sombres devient souvent un point d’attention. Comparer les contrastes aide à comprendre pourquoi un élément ressort davantage que ses voisins. Regardez ce qui se trouve immédiatement autour de cette zone : la différence peut venir de la luminosité, de la couleur ou de la netteté. Comparez ensuite avec une autre partie claire pour voir si elle joue le même rôle dans la composition. Une tache lumineuse isolée attire parfois davantage l’œil qu’une surface claire étendue, surtout si ses contours sont nets. À l’inverse, une grande zone éclairée peut organiser l’image sans être le premier endroit regardé. Décrivez le rapport entre les deux surfaces : l’une est-elle plus claire, plus saturée ou plus précise que l’autre ? Observez également si le contraste forme une limite entre deux plans ou met en évidence un détail à l’intérieur d’une même forme. Dans une image animée, ces rapports peuvent changer au fil des secondes ; il est donc utile de distinguer l’emplacement du contraste et son évolution. Essayez enfin de masquer mentalement le point le plus frappant et regardez où votre attention se déplace. Cette comparaison montre si le contraste est le seul indice qui guide le parcours ou s’il est renforcé par la composition et les directions des formes.`,
        video: { src: '/assets/LcXkmXyuZQ.mp4', title: 'Courte vidéo de paysage' },
      },
      {
        heading: 'Les pauses visuelles',
        paragraph: `Une étendue calme ou un espace moins détaillé donne au regard le temps de se reposer. Ces pauses équilibrent les zones chargées. Repérez un ciel uniforme, une pente régulière ou un arrière-plan peu contrasté, puis comparez sa surface avec les détails voisins. Un espace simple n’est pas vide : il peut mettre en valeur ce qui l’entoure et ralentir la lecture de l’image. Observez sa forme et la manière dont elle touche les zones plus complexes. Une surface calme peut entourer un arbre isolé, ouvrir un passage entre deux reliefs ou créer une limite autour d’un groupe d’objets. Demandez-vous si elle attire votre regard, le retient ou le laisse repartir vers une autre partie de la scène. Les détails rares peuvent aussi devenir plus visibles parce qu’ils sont séparés de leurs voisins. Comparez deux espaces simples : l’un peut sembler équilibré, l’autre interrompu par une ligne ou une ombre. Cette différence ne dépend pas uniquement de la quantité de détails, mais aussi de leur répartition et de leur contraste. Lorsque vous formulez votre observation, décrivez la surface et ce qui la borde avant de lui attribuer un rôle. Vous pourrez ensuite expliquer comment cet espace calme modifie le rythme de lecture ou met en valeur une forme proche.`,
      },
      {
        heading: 'Formuler une observation',
        paragraph: `Une phrase utile nomme un élément observable et sa place dans l’image. On peut ensuite expliquer comment il guide le regard, sans confondre description et interprétation. Commencez par un fait que tout le monde peut retrouver, comme une ligne diagonale au premier plan. Ajoutez ensuite son effet possible, en laissant visible la différence entre ce que vous voyez et ce que vous en déduisez. Une formulation peut suivre trois étapes : nommer le repère, indiquer où il se trouve, puis expliquer la relation qu’il entretient avec le reste. « Une ligne sombre traverse le premier plan et conduit vers la crête » donne un emplacement et une direction. « Elle rend la scène mystérieuse » exprime une impression, mais ne dit pas quel indice la provoque. Vous pouvez réunir les deux idées en signalant clairement le lien : la ligne conduit vers une zone qui reste en partie cachée, ce qui peut produire cette impression. Évitez les termes trop généraux tant qu’ils ne sont pas accompagnés d’un exemple visible. Si vous écrivez « la composition est équilibrée », précisez quelles masses ou quelles couleurs se répondent. Relisez ensuite votre phrase en vous demandant si une autre personne pourrait retrouver le repère sans votre aide. Cette vérification rend l’observation plus claire tout en laissant place à plusieurs interprétations raisonnables de la même scène.`,
      },
    ],
  },
  {
    id: 'chapter-1-quiz',
    chapterId: 'chapter-1',
    kind: 'quiz',
    title: 'Quiz du chapitre 1',
    question: {
      type: 'single',
      prompt: 'Quel repère aide d’abord à comprendre la séparation entre le ciel et le relief ?',
      answers: [
        { id: 'horizon', label: 'La ligne d’horizon' },
        { id: 'texture', label: 'La texture d’une feuille' },
        { id: 'ombre', label: 'La durée d’une ombre' },
      ],
      correctAnswerIds: ['horizon'],
    },
  },
  {
    id: 'chapter-2-light',
    chapterId: 'chapter-2',
    kind: 'content',
    title: 'Observer la lumière',
    sections: [
      {
        heading: 'La direction de la lumière',
        paragraph: `La lumière révèle certaines formes et en laisse d’autres dans l’ombre. Observer sa direction permet de situer les reliefs et d’anticiper les contrastes. Repérez les surfaces les plus éclairées, puis cherchez de quel côté les ombres s’étendent. Les pentes orientées vers la lumière semblent parfois plus proches ou plus saillantes ; vérifiez cette impression avec leur contour et les éléments qui les recouvrent. Pour éviter de vous appuyer sur une seule tache claire, comparez plusieurs surfaces voisines. Une face éclairée et une face sombre peuvent appartenir au même relief ; leur limite aide alors à comprendre son orientation. Cherchez également les ombres portées au sol et comparez leur direction avec celle des parties lumineuses. Si elles semblent pointer vers des côtés différents, la scène peut comporter plusieurs sources ou une lumière réfléchie. Il est aussi possible que la forme du terrain modifie l’impression générale. Décrivez d’abord ce qui est clair et ce qui est sombre, puis proposez une direction seulement si plusieurs indices concordent. Vous pouvez situer cette direction par rapport au cadre, par exemple « la lumière arrive depuis le côté gauche ». Enfin, observez quelles formes restent lisibles dans l’ombre et lesquelles se confondent avec l’arrière-plan. La lumière ne montre pas seulement la couleur des surfaces ; elle aide à lire leurs volumes et leurs relations.`,
        image: { src: '/assets/28970388742_2f75d527d6_z.jpg', alt: 'Lumière latérale sur un sentier' },
      },
      {
        heading: 'Les valeurs claires et sombres',
        paragraph: `Une scène peut réunir des zones très claires et des zones sombres. Leur comparaison donne une première structure avant de distinguer les couleurs. Observez la répartition de ces valeurs dans le cadre : une grande zone sombre peut équilibrer un petit point lumineux. Demandez-vous aussi si le contraste dessine une limite, révèle un volume ou attire simplement l’attention vers un endroit précis. Pour comparer les valeurs, plissez légèrement les yeux ou concentrez-vous sur les surfaces sans les nommer par leur couleur. Repérez les masses principales et voyez si elles se répartissent plutôt d’un côté, vers le centre ou en bandes successives. Une transition douce peut donner du relief sans produire de frontière nette ; un contraste abrupt peut, au contraire, découper deux surfaces qui se touchent. Regardez si plusieurs zones claires forment un trajet ou si une seule domine toutes les autres. Le contraste dépend aussi de son entourage : le même gris paraît plus clair près d’une surface sombre et plus foncé près d’une surface lumineuse. Dans une description, précisez donc avec quoi vous faites la comparaison. Vous pouvez ensuite indiquer si cette différence aide à distinguer une forme, à séparer deux plans ou à attirer l’attention. Cette démarche rend la lecture des contrastes plus précise avant d’aborder les nuances de couleur ou l’interprétation de la lumière.`,
      },
      {
        heading: 'Les ombres portées',
        paragraph: `Une ombre portée indique souvent la forme d’un obstacle et la direction de la source lumineuse. Elle peut aussi renforcer la profondeur entre deux plans. Suivez l’ombre jusqu’à l’objet qui la produit, puis comparez leurs orientations. Une ombre longue transforme la lecture d’un relief et peut relier deux zones qui sembleraient autrement séparées. Son bord est-il net ou diffus ? Une limite nette peut indiquer une lumière directe, tandis qu’une limite douce se confond davantage avec les variations de la surface. Vérifiez si l’ombre commence au pied de l’objet ou si un espace lumineux les sépare. Ce détail aide à distinguer une ombre portée d’une zone simplement plus sombre. Observez sa longueur par rapport à l’élément qui la projette, sans oublier que la perspective peut modifier cette comparaison. Dans une scène vidéo, la position de l’ombre peut évoluer et montrer un changement de lumière, de caméra ou d’objet. Repérez d’abord ce qui demeure stable, puis comparez l’ombre à plusieurs moments. Vous pouvez décrire sa direction, sa forme et la surface qu’elle traverse. Évitez de nommer la source avec certitude si l’image ne permet pas de la voir ; indiquez plutôt que l’ombre suggère une lumière venant d’un côté précis. Cette prudence conserve la différence entre l’indice observé et la cause que vous en déduisez.`,
        image: { src: '/assets/28999069391_5893263112_z.jpg', alt: 'Ombres et détails dans la végétation' },
      },
      {
        heading: 'Une lumière qui change',
        paragraph: `Dans une vidéo, la lumière peut évoluer au fil du temps. On peut comparer plusieurs instants et décrire ce qui devient plus visible ou plus discret. Fixez un repère stable, comme le bord d’un chemin, puis regardez comment son éclairage change. Une variation peut venir du déplacement de la caméra, d’un nuage ou d’un changement de direction : distinguez ce qui bouge de ce qui s’éclaire. Choisissez un moment de départ et gardez en mémoire la position des formes importantes. Lorsque le plan avance, vérifiez si ces formes se déplacent dans le cadre ou si leur luminosité change alors qu’elles restent à la même place. Une ombre qui glisse sur un terrain fixe ne raconte pas la même chose qu’un terrain qui se déplace avec la caméra. Vous pouvez aussi comparer la netteté : un élément qui devient flou peut s’éloigner de la zone de mise au point, même si sa lumière reste stable. Décrivez l’ordre des changements en utilisant des repères temporels simples, comme « au début », « ensuite » ou « vers la fin ». Si plusieurs phénomènes ont lieu en même temps, isolez-en un avant de relier les autres. Une observation temporelle gagne en précision lorsqu’elle distingue le mouvement, l’éclairage et le cadrage. Ces indices permettent de raconter l’évolution de la scène sans attribuer trop vite une cause à chaque variation.`,
      },
    ],
  },
  {
    id: 'chapter-2-details',
    chapterId: 'chapter-2',
    kind: 'content',
    title: 'Lire les détails',
    sections: [
      {
        heading: 'Choisir un détail',
        paragraph: `Après avoir repéré les grandes formes, on choisit un détail et on l’observe de près. Cette étape évite de décrire trop d’éléments à la fois. Sélectionnez un élément que vous pouvez désigner sans ambiguïté, puis décrivez sa forme, sa couleur et son emplacement. Résistez à l’envie d’expliquer immédiatement son origine : une observation précise commence par ce qui est effectivement visible. Pour le localiser, utilisez un repère voisin ou une partie du cadre : « près du bord supérieur », « derrière le groupe d’arbres » ou « au milieu du sentier ». Regardez ensuite ses contours, sa taille apparente et les marques qui le distinguent des éléments proches. Si plusieurs objets se ressemblent, précisez celui que vous avez choisi avant d’énumérer ses caractéristiques. Vous pouvez suivre une méthode courte : décrire l’extérieur, noter une particularité, puis vérifier comment l’objet se rattache au plan où il se trouve. Demandez-vous si votre description resterait valable pour une autre image semblable ; si oui, elle manque peut-être d’un repère propre à cette scène. Enfin, séparez le détail lui-même de son explication. Vous pourrez proposer une hypothèse après avoir établi ce qui la soutient. Cette progression garde l’attention sur un seul élément et rend la description plus facile à compléter sans perdre de vue l’ensemble de l’image.`,
        image: { src: '/assets/28999069391_5893263112_z.jpg', alt: 'Détail de feuilles et de branches' },
      },
      {
        heading: 'Comparer les textures',
        paragraph: `Les surfaces lisses, rugueuses ou répétées se distinguent par leurs motifs. Une comparaison précise peut s’appuyer sur la taille, la fréquence et l’orientation de ces motifs. Regardez une pierre puis une feuille : leurs marques n’occupent ni la même échelle ni la même direction. Décrivez ces différences avec des critères concrets plutôt qu’avec un seul adjectif général comme « détaillé ». Une texture serrée peut former une masse presque uniforme à distance, tandis que ses éléments deviennent visibles quand on s’en approche. Comparez des surfaces éclairées de façon similaire pour ne pas confondre texture et ombre. Les nervures d’une feuille, les lignes d’une roche ou les répétitions de branches ne suivent pas toujours la même orientation. Cherchez si leurs motifs sont réguliers, interrompus ou organisés en petites zones. La texture peut aussi changer progressivement : les marques se resserrent, s’effacent ou se répètent moins nettement vers le fond. Notez l’échelle de votre comparaison. Dire « les motifs sont petits » est plus précis si vous indiquez qu’ils sont petits par rapport aux feuilles voisines ou à une pierre du premier plan. Évitez de tirer une conclusion sur la matière à partir d’une seule marque floue. En associant la fréquence, la forme et l’orientation, vous pouvez comparer les surfaces sans dépendre d’une impression générale difficile à partager.`,
      },
      {
        heading: 'Relier le détail à son plan',
        paragraph: `Un détail prend son sens dans l’espace. Sa netteté, sa taille et sa position donnent des indices sur sa distance par rapport au point de vue. Vérifiez si un autre élément le recouvre, s’il paraît plus petit qu’un objet comparable ou si ses contours sont moins précis. Aucun indice ne suffit toujours à lui seul ; plusieurs observations concordantes rendent la description plus solide. Commencez par repérer les objets qui se chevauchent. Celui qui masque une partie de l’autre semble généralement situé devant, même si la limite entre eux n’est pas nette. Comparez ensuite des formes de taille connue ou qui se répètent, comme des arbres alignés le long d’un chemin. Leur taille apparente peut diminuer vers le fond, mais un objet réellement plus petit peut produire le même effet ; cherchez d’autres indices avant de conclure. La netteté et le contraste varient aussi avec l’éclairage, la mise au point et la qualité de l’image. Une forme proche peut être floue parce qu’elle bouge, tandis qu’un élément lointain reste net. Notez donc chaque indice séparément, puis observez s’ils convergent. Pour une description claire, dites où se trouve le détail et ce qui le relie aux plans voisins. Vous pourrez parler de distance avec prudence en précisant les éléments qui soutiennent votre lecture. Cette méthode évite de transformer un indice isolé en certitude et laisse une place à d’autres explications possibles.`,
      },
    ],
  },
  {
    id: 'chapter-2-synthesis',
    chapterId: 'chapter-2',
    kind: 'content',
    title: 'Construire une synthèse',
    sections: [
      {
        heading: 'Décrire avant d’expliquer',
        paragraph: `Une synthèse commence par des faits visibles : formes, emplacement, lumière et plans. Les observations restent vérifiables par une autre personne. Reprenez les repères que vous avez déjà nommés et choisissez ceux qui organisent vraiment la scène. Évitez d’accumuler tous les détails : quelques éléments bien situés permettent de construire une description claire et partageable. Vous pouvez d’abord noter les faits sans les classer : une crête en arrière-plan, une zone sombre à gauche, un chemin qui part du bas de l’image. Relisez ensuite ces éléments et demandez-vous lesquels aident le plus à reconstruire la scène. Un détail qui ne modifie ni le parcours du regard ni la compréhension des plans peut rester de côté. Gardez les formulations vérifiables et signalez lorsque vous passez à une interprétation. Par exemple, la description d’une pente éclairée peut précéder l’idée qu’elle dirige l’attention vers le fond. Ne répétez pas plusieurs fois le même indice avec des mots différents ; utilisez plutôt l’espace gagné pour préciser les relations entre les formes. Une synthèse n’est pas une liste plus longue. C’est une sélection organisée qui permet à une personne absente de comprendre ce qui domine, où les éléments se trouvent et comment ils se répondent. Vérifiez enfin que chaque idée importante s’appuie sur un repère visible dans la scène.`,
        image: { src: '/assets/35c8ec5a07fc.jpg', alt: 'Vue d’ensemble du paysage' },
      },
      {
        heading: 'Organiser les idées',
        paragraph: `On peut présenter la scène du premier plan vers l’arrière-plan, ou suivre le chemin visuel principal. La structure choisie rend le récit plus facile à suivre. Gardez le même ordre d’un paragraphe à l’autre et annoncez les changements de plan avec des mots de liaison. Le lecteur peut alors reconstruire le parcours sans devoir deviner où se trouve chaque élément. Avant de rédiger, choisissez un itinéraire simple. Vous pouvez partir d’un élément proche, décrire ce qui le relie au milieu de l’image, puis terminer par les formes qui ferment le paysage. Une autre possibilité consiste à suivre une ligne qui conduit vers un point d’arrêt, puis à décrire les zones qu’elle traverse. Évitez de passer d’un coin à l’autre sans signaler ce déplacement. Des mots comme « devant », « derrière », « à côté » ou « plus loin » indiquent des relations spatiales ; « ensuite » et « enfin » marquent la progression de la description. Vous n’avez pas besoin de répéter la même formule à chaque phrase. Utilisez-les lorsque le lecteur pourrait perdre le fil ou confondre deux éléments. Relisez ensuite votre texte en imaginant que vous ne voyez pas l’image. Pouvez-vous suivre l’ordre annoncé ? Si une transition manque, ajoutez le lien qui explique pourquoi vous passez d’un élément au suivant. Cette organisation donne un rythme à la synthèse tout en gardant chaque observation attachée à une place précise.`,
      },
      {
        heading: 'Appuyer chaque phrase',
        paragraph: `Chaque interprétation gagne à s’appuyer sur un détail concret. On nomme d’abord le repère, puis on explique ce qu’il suggère. Par exemple, une ligne qui remonte vers la crête peut donner une direction au regard ; une zone pâle peut évoquer la distance. Indiquez toujours l’indice qui soutient votre idée afin que la relation entre observation et interprétation reste compréhensible. Une phrase peut associer un constat et une proposition : « le chemin se rétrécit en allant vers la crête, ce qui renforce l’impression de profondeur ». Le rétrécissement est le repère ; l’effet de profondeur est l’interprétation. Si vous affirmez que la lumière attire l’attention, décrivez d’abord la différence de contraste ou la position de la zone éclairée. Si vous dites qu’un élément semble proche, précisez sa taille, sa netteté ou le recouvrement qui vous conduit à cette idée. Tous les indices ne sont pas également fiables, et certains peuvent recevoir plusieurs explications. Vous pouvez donc nuancer votre phrase avec « semble », « peut suggérer » ou « contribue à ». Ces mots ne rendent pas l’observation moins utile ; ils rendent visible le degré de certitude. Relisez chaque interprétation en cherchant la preuve qui la soutient. Si vous ne pouvez pas nommer cet indice, revenez à la description ou présentez votre idée comme une question à vérifier.`,
        image: { src: '/assets/28970388742_2f75d527d6_z.jpg', alt: 'Sentier reliant plusieurs plans du paysage' },
      },
      {
        heading: 'Terminer par une idée claire',
        paragraph: `La dernière phrase résume le point principal sans répéter toute la description. Elle peut rappeler le parcours du regard ou la relation entre les éléments. Relisez vos observations et cherchez ce qui les relie : une direction dominante, un contraste ou une succession de plans. La conclusion doit refermer le propos tout en restant fidèle aux détails que vous avez réellement repérés. Choisissez l’idée qui aide le mieux à comprendre la scène dans son ensemble. Elle peut reprendre le trajet décrit depuis le premier plan, montrer comment une lumière sépare deux surfaces ou rappeler la forme qui organise le cadre. N’ajoutez pas un nouvel objet ou une cause qui n’a pas été examinée auparavant. Une synthèse se termine plus clairement lorsqu’elle rapproche des indices déjà présentés plutôt que lorsqu’elle ouvre une nouvelle piste. Vérifiez que votre dernière phrase ne transforme pas une hypothèse en certitude. Si la scène suggère plusieurs lectures, vous pouvez rappeler celle que vos observations soutiennent le mieux sans prétendre exclure les autres. Retirez ensuite les répétitions : le début expose les repères, les phrases suivantes expliquent leurs relations, la conclusion en tire une idée générale. Lisez le texte du début à la fin et demandez-vous si une personne pourrait reconstruire le même parcours visuel. Si la réponse est oui, votre synthèse est à la fois concise dans son idée principale et suffisamment étayée par les détails observés.`,
      },
    ],
  },
  {
    id: 'final-question-1',
    chapterId: 'chapter-final',
    kind: 'quiz',
    title: 'Question 1 sur 3',
    question: {
      type: 'boolean',
      prompt: 'Quel élément aide à situer la séparation entre ciel et relief ?',
      answers: [
        { id: 'vrai', label: 'La ligne d’horizon' },
        { id: 'faux', label: 'Le format du fichier' },
      ],
      correctAnswerIds: ['vrai'],
    },
  },
  {
    id: 'final-question-2',
    chapterId: 'chapter-final',
    kind: 'quiz',
    title: 'Question 2 sur 3',
    question: {
      type: 'single',
      prompt: 'À quoi sert la comparaison des plans ?',
      answers: [
        { id: 'profondeur', label: 'À comprendre la profondeur de la scène' },
        { id: 'duree', label: 'À mesurer la durée de la vidéo' },
        { id: 'son', label: 'À déterminer le niveau sonore' },
      ],
      correctAnswerIds: ['profondeur'],
    },
  },
  {
    id: 'final-question-3',
    chapterId: 'chapter-final',
    kind: 'quiz',
    title: 'Question 3 sur 3',
    question: {
      type: 'multiple',
      prompt: 'Quelle démarche produit une observation claire ?',
      answers: [
        { id: 'repere', label: 'Nommer un repère visible' },
        { id: 'explication', label: 'Expliquer son rôle dans la scène' },
        { id: 'supposition', label: 'Commencer par une supposition sans détail' },
      ],
      correctAnswerIds: ['repere', 'explication'],
    },
  },
  {
    id: 'course-congratulations',
    chapterId: 'chapter-final',
    kind: 'conclusion',
    menuVisible: false,
    title: 'Félicitations',
  },
]

/** Identifies the three pages whose correct answers make up the final score. */
export const COURSE_FINAL_QUESTION_IDS = [
  'final-question-1',
  'final-question-2',
  'final-question-3',
] as const

/** Identifies the first course page used by denied and failed routes. */
export const COURSE_START_PAGE_ID = 'chapter-1-intro'
