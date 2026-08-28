import type { StrapCollection } from 'codplay-v1/player/strap-types';
import type { SceneDoc } from 'codplay-v1/player/types';
import './s6-dnd-list-scene.css';

// ─── state (auteur — codplay ne connaît que ce que le guard restitue) ───────

type S6DndState = {
	itemListById: Record<string, string>;
};

const LIST_IDS = ['list-a', 'list-b'] as const;
const ITEM_IDS = ['item-1', 'item-2', 'item-3'] as const;

// ─── straps ───────────────────────────────────────────────────────────────

export const s6Straps: StrapCollection = {
	// Déclenché directement par l'event `endEmit` de la capture
	// (`item:dropped:${id}`), écouté via `story.listen` — plus de module
	// intermédiaire : `move` (avec `parentId`/`mode` déjà résolus par
	// `list-dnd`, matérialisé dans `captureState` avant `endEmit`) est une
	// action perso ordinaire, prise en charge entièrement par
	// `moveModule`/`list-flip`.
	'update-list-counts': ({ state, event }) => {
		const data = event.data as { persoId: string; move: { parentId: string } };
		const dnd = state as S6DndState;
		const itemListById = { ...dnd.itemListById, [data.persoId]: data.move.parentId };

		const countA = Object.values(itemListById).filter((listId) => listId === 'list-a').length;
		const countB = Object.values(itemListById).filter((listId) => listId === 'list-b').length;

		return {
			update: { itemListById },
			events: [
				{ name: 'count:update:a', data: { content: String(countA) } },
				{ name: 'count:update:b', data: { content: String(countB) } },
			],
		};
	},
};

// ─── helpers ─────────────────────────────────────────────────────────────

function makeItemPerso(id: string, label: string, background: string): Record<string, unknown> {
	return {
		id,
		type: 'text',
		initial: {
			tag: 'div',
			content: label,
			move: { parentId: 'list-a' },
			// `user-select: none` vient de la classe CSS `.s6-dnd-item` (voir
			// s6-dnd-list-scene.css), pas d'un style inline : le pipeline de style
			// des composants (applyStyleProps -> anime.js `utils.set`) mutile les
			// noms de propriété préfixés vendeur (`webkitUserSelect` devient
			// `webkit-user-select` sans le tiret initial et l'assignation via
			// bracket notation est silencieusement ignorée) — un vrai style
			// permanent d'auteur comme celui-ci doit donc passer par une classe.
			className: 's6-dnd-item',
			style: {
				padding: '10px 14px',
				background,
				color: '#fff',
				borderRadius: '8px',
				cursor: 'grab',
				fontWeight: '600',
				position: 'relative',
			},
		},
		emit: {
			pointerdown: {
				event: { name: 'item:drag:start', cascade: true },
				capture: {
					stateScope: 'story',
					// Guard : chaque item est toujours draggable, les deux listes sont
					// toujours des cibles valides — aucune règle de capacité dans cette
					// démo (comportement inchangé par rapport à avant ce chantier).
					// trackCommand est omis : le suivi 1:1 du pointeur s'applique par
					// défaut, et le signal de preview dnd est produit automatiquement
					// (voir "Architecture retenue § 1. Preview" du plan).
					initCaptureState: () => ({ dropIn: [...LIST_IDS] }),
					// Nom par item, jamais partagé : le director résout une action
					// perso pour CHAQUE perso déclarant cette clé dans `actions` — un
					// nom partagé ferait committer les trois items sur le drop d'un
					// seul (même motif que `item:drag:tracking:${id}` avant ce
					// chantier, appliqué ici à `endEmit`).
					endEmit: { name: `item:dropped:${id}` },
				},
			},
		},
		actions: {
			// Vide à dessein : juste présent pour activer la fusion action
			// statique + payload d'event (`mergeActionWithEventPayload`) — `move`
			// vient entièrement de `captureState` (résolu par `list-dnd` pendant
			// le drag, injecté avant `endEmit`), jamais déclaré ici en dur.
			[`item:dropped:${id}`]: {},
		},
	};
}

// ─── scene ───────────────────────────────────────────────────────────────

export function createS6DndListScene(): SceneDoc {
	return {
		id: 's6-dnd-list-scene',
		initial: undefined,
		straps: [],
		listen: [],
		stories: {
			's6-main-story': {
				id: 's6-main-story',
				state: {
					itemListById: { 'item-1': 'list-a', 'item-2': 'list-a', 'item-3': 'list-a' },
				} satisfies S6DndState,
				initial: { move: '@root' },
				straps: s6Straps,
				// Un event par item (`item:dropped:${id}`, jamais partagé — voir
				// `makeItemPerso`), donc une règle par item : `story.listen` route
				// par nom d'event, indépendamment de toute action perso.
				listen: ITEM_IDS.map((id) => ({ on: `item:dropped:${id}`, straps: ['update-list-counts'] })),
				eventimes: [{ name: 'sequence:end', startAt: 60000 }],
				persos: [
					// ── conteneur principal (grille 2×2) ────────────────────────────
					{
						id: 's6-shell',
						type: 'tag',
						initial: {
							move: '@root',
							style: {
								display: 'grid',
								gridTemplateColumns: '1fr 1fr',
								gridTemplateRows: 'auto auto',
								gap: '12px 40px',
								padding: '24px',
								background: '#f1f5f9',
								borderRadius: '16px',
								userSelect: 'none',
								width: '480px',
							},
						},
						actions: {},
					},

					// ── listes (drop zones, ligne 1 de la grille) ────────────────────
					{
						id: 'list-a',
						type: 'list',
						initial: {
							move: { parentId: 's6-shell' },
							style: {
								minHeight: '180px',
								border: '2px dashed #94a3b8',
								borderRadius: '10px',
								padding: '8px',
								display: 'flex',
								flexDirection: 'column',
								gap: '8px',
								background: 'rgba(255,255,255,0.6)',
							},
						},
						actions: {},
					},
					{
						id: 'list-b',
						type: 'list',
						initial: {
							move: { parentId: 's6-shell' },
							style: {
								minHeight: '180px',
								border: '2px dashed #94a3b8',
								borderRadius: '10px',
								padding: '8px',
								display: 'flex',
								flexDirection: 'column',
								gap: '8px',
								background: 'rgba(255,255,255,0.6)',
							},
						},
						actions: {},
					},

					// ── compteurs (hors listes, ligne 2 de la grille) ────────────────
					{
						id: 'count-a',
						type: 'text',
						initial: {
							tag: 'span',
							content: '3',
							move: { parentId: 's6-shell' },
							style: { fontSize: '13px', color: '#64748b', pointerEvents: 'none' },
						},
						actions: { 'count:update:a': {} },
					},
					{
						id: 'count-b',
						type: 'text',
						initial: {
							tag: 'span',
							content: '0',
							move: { parentId: 's6-shell' },
							style: { fontSize: '13px', color: '#64748b', pointerEvents: 'none' },
						},
						actions: { 'count:update:b': {} },
					},

					// ── items draggables (initialement dans list-a) ──────────────────
					makeItemPerso('item-1', 'Item 1', '#4f46e5'),
					makeItemPerso('item-2', 'Item 2', '#0891b2'),
					makeItemPerso('item-3', 'Item 3', '#059669'),
				],
			},
		},
		tracks: {},
	} as unknown as SceneDoc;
}
