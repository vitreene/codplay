import type { V2DemoModule } from './layout/types';

/** Keeps Vite development CSS imports fetchable by the external preload strategy. */
function resolveStylesheetUrl(url: string): string {
	if (!import.meta.env.DEV) return url;
	return `${url}${url.includes('?') ? '&' : '?'}direct`;
}

/** Static metadata used by the common layout before a demo scene is loaded. */
export type V2DemoDefinition = Readonly<{
	id: string;
	path: string;
	title: string;
	description: string;
	load: () => Promise<V2DemoModule>;
}>;

/** V2 demos are loaded on demand so the selector does not import every scene. */
export const V2_DEMO_REGISTRY: readonly V2DemoDefinition[] = [
	{
		id: 'flip-list',
		path: '?demo=flip-list',
		title: 'FLIP stress test',
		description:
			'Deux listes échangent leurs éléments un par un pendant que leurs conteneurs se déplacent et que la fenêtre peut être redimensionnée.',
		load: async () => {
			const [module, stylesheet] = await Promise.all([
				import('./demos/flip-stress/main'),
				import('./demos/flip-stress/style.css?url'),
			]);
			return {
				createScene: module.createScene,
				durationMs: module.SCENE_DURATION_MS,
				stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
			};
		},
	},
	{
		id: 'components',
		path: '?demo=components',
		title: 'basic components',
		description: 'Une scène présente une image, un polygone SVG et une question interactive sur la même timeline.',
		load: async () => {
			const [module, stylesheet] = await Promise.all([
				import('./demos/components/components-scene'),
				import('./demos/components/style.css?url'),
			]);
			return {
				createScene: module.createComponentsScene,
				durationMs: module.SCENE_DURATION_MS,
				stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
			};
		},
	},

	{
		id: 'flip-nested',
		path: '?demo=flip-nested',
		title: 'flip imbriqué',
		description:
			'Un parent et son enfant changent de conteneur ensemble, tandis que les éléments voisins restent dans leur liste.',
		load: async () => {
			const [module, stylesheet] = await Promise.all([
				import('./demos/runner/main'),
				import('./demos/runner/style.css?url'),
			]);
			return {
				createScene: module.createNestedFlipScene,
				durationMs: module.SCENE_DURATION_MS,
				stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
			};
		},
	},
	{
		id: 'quiz-series',
		path: '?demo=quiz-series',
		title: 'Quiz — Série de 3 questions',
		description: 'Vrai/Faux, réponse unique, réponses multiples. Résultat final : 2/3 pour réussir.',
		load: async () => {
			const [module, stylesheet] = await Promise.all([
				import('./demos/quiz-series/main'),
				import('./demos/quiz-series/style.css?url'),
			]);
			return {
				createScene: module.createScene,
				durationMs: module.SCENE_DURATION_MS,
				stylesheetUrl: resolveStylesheetUrl(stylesheet.default),
			};
		},
	},
];

/** Resolves one selected V2 demo and falls back to the first registered entry. */
export function resolveV2Demo(id: string | null): V2DemoDefinition {
	return V2_DEMO_REGISTRY.find((demo) => demo.id === id) ?? V2_DEMO_REGISTRY[0]!;
}
