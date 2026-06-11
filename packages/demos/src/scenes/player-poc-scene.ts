import { RUNTIME_EVENT_SOURCE } from 'codplay/core/events/constants'
import type { PersoDoc, SceneDoc } from 'codplay/player/types'

export const playerPocRootNodeIds = ['demo-stage-list', 'demo-list', 'demo-trash-list']

/**
 * Removes duplicated initial.id when it only mirrors the perso id.
 */
function normalizeDemoPersos(persoById: Record<string, PersoDoc>): PersoDoc[] {
	return Object.values(persoById).map((perso) => {
		const nextInitial = { ...perso.initial }
		if (nextInitial.id === perso.id) {
			delete nextInitial.id
		}

		return {
			...perso,
			initial: nextInitial,
		}
	})
}

/**
 * Creates the move-focused proof-of-concept scene shared by Player and CodPlay demos.
 */
export function createPlayerPocScene(): SceneDoc {
	const persoById: Record<string, PersoDoc> = {
		'demo-list': {
			id: 'demo-list',
			type: 'list',
			initial: {
				id: 'demo-list',
				className: 'demo-card demo-list-main',
				style: {
					position: 'absolute',
					left: '50%',
					top: '50%',
					marginLeft: '-190px',
					marginTop: '-160px',
					width: '380px',
					minHeight: '320px',
					padding: '16px',
					backgroundColor: '#eef7f6',
					border: '2px dashed #0b7a75',
					borderRadius: '14px',
					boxShadow: '0 10px 24px rgba(16, 38, 67, 0.18)',
					transform: 'rotate(24deg) scale(0.77)',
					transformOrigin: 'center',
					zIndex: 1,
				},
			},
			actions: {
				'demo:lists:drift': {
					style: {
						x: {
							from: 0,
							to: 130,
							duration: 12000,
							easing: 'linear',
						},
						y: {
							from: 0,
							to: -35,
							duration: 12000,
							easing: 'linear',
						},
						rotate: {
							from: 24,
							to: 40,
							duration: 12000,
							easing: 'linear',
						},
					},
				},
			},
		},
		'demo-stage-list': {
			id: 'demo-stage-list',
			type: 'list',
			initial: {
				id: 'demo-stage-list',
				className: 'demo-card',
				style: {
					position: 'absolute',
					left: '8%',
					top: '16%',
					width: '240px',
					minHeight: '320px',
					padding: '12px',
					backgroundColor: '#fff4df',
					border: '2px solid #f7b267',
					borderRadius: '14px',
					boxShadow: '0 10px 24px rgba(16, 38, 67, 0.12)',
					transform: 'rotate(-10deg) scale(1.1)',
					zIndex: 0,
				},
			},
			actions: {
				'demo:lists:drift': {
					style: {
						x: {
							from: 0,
							to: -95,
							duration: 12000,
							easing: 'linear',
						},
						y: {
							from: 0,
							to: 28,
							duration: 12000,
							easing: 'linear',
						},
						rotate: {
							from: -10,
							to: 6,
							duration: 12000,
							easing: 'linear',
						},
					},
				},
			},
		},
		'demo-trash-list': {
			id: 'demo-trash-list',
			type: 'list',
			initial: {
				id: 'demo-trash-list',
				style: {
					display: 'none',
				},
			},
			actions: {},
		},
		'demo-item-1': {
			id: 'demo-item-1',
			type: 'text',
			initial: {
				id: 'demo-item-1',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
				},
				className: 'demo-list-item',
				content: 'ITEM 1',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#f25f5c',
					transform: 'rotate(-4deg) scale(0.98)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-1:add': {
					move: { parentId: 'demo-list', flipMode: 'overlay-world' },
				},
				'demo:item-1:return-origin': {
					move: { parentId: 'demo-stage-list', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-2': {
			id: 'demo-item-2',
			type: 'text',
			initial: {
				id: 'demo-item-2',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
				},
				className: 'demo-list-item',
				content: 'ITEM 2',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#f7b267',
					transform: 'rotate(3deg) scale(1.01)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-2:add': {
					move: { parentId: 'demo-list', flipMode: 'overlay-world' },
				},
				'demo:item-2:return-origin': {
					move: { parentId: 'demo-stage-list', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-3': {
			id: 'demo-item-3',
			type: 'text',
			initial: {
				id: 'demo-item-3',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
				},
				className: 'demo-list-item',
				content: 'ITEM 3',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#70c1b3',
					transform: 'rotate(-2deg) scale(0.99)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-3:add': {
					move: { parentId: 'demo-list', flipMode: 'overlay-world' },
				},
				'demo:item-3:to-first': {
					move: { parentId: 'demo-list', mode: 'first' },
				},
				'demo:item-3:return-origin': {
					move: { parentId: 'demo-stage-list', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-4': {
			id: 'demo-item-4',
			type: 'text',
			initial: {
				id: 'demo-item-4',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
				},
				className: 'demo-list-item',
				content: 'ITEM 4',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#247ba0',
					transform: 'rotate(2deg) scale(1.02)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-4:add': {
					move: { parentId: 'demo-list', flipMode: 'overlay-world' },
				},
				'demo:item-4:return-origin': {
					move: { parentId: 'demo-stage-list', flipMode: 'overlay-world' },
				},
			},
		},
		'demo-item-5': {
			id: 'demo-item-5',
			type: 'text',
			initial: {
				id: 'demo-item-5',
				tag: 'div',
				move: {
					parentId: 'demo-stage-list',
				},
				className: 'demo-list-item',
				content: 'ITEM 5',
				style: {
					padding: '0.7rem 0.85rem',
					marginBottom: '0.5rem',
					borderRadius: '0.6rem',
					color: '#ffffff',
					fontWeight: 700,
					letterSpacing: '0.04em',
					backgroundColor: '#b388eb',
					transform: 'rotate(-3deg) scale(1)',
					transformOrigin: 'center',
				},
			},
			actions: {
				'demo:item-5:add': {
					move: { parentId: 'demo-list', flipMode: 'overlay-world' },
				},
				'demo:item-5:return-origin': {
					move: { parentId: 'demo-stage-list', flipMode: 'overlay-world' },
				},
			},
		},
	}

	return {
		id: 'scene-demo',
		rootStories: ['story-demo'],
		initial: undefined,
		straps: undefined,
		listen: [],
		stories: {
			'story-demo': {
				id: 'story-demo',
				entries: Object.keys(persoById),
				initial: undefined,
				persos: normalizeDemoPersos(persoById),
				straps: undefined,
				listen: [],
			},
		},
		tracks: {
			'track-demo': {
				id: 'track-demo',
				source: RUNTIME_EVENT_SOURCE.story,
				order: 0,
				events: [
					{ ms: 0, name: 'demo:lists:drift' },
					{ ms: 1000, name: 'demo:item-1:add' },
					{ ms: 2000, name: 'demo:item-2:add' },
					{ ms: 3000, name: 'demo:item-3:add' },
					{ ms: 4000, name: 'demo:item-4:add' },
					{ ms: 5000, name: 'demo:item-5:add' },
					{ ms: 6200, name: 'demo:item-3:to-first' },
					{ ms: 7200, name: 'demo:item-1:return-origin' },
					{ ms: 7600, name: 'demo:item-2:return-origin' },
					{ ms: 8000, name: 'demo:item-3:return-origin' },
					{ ms: 8400, name: 'demo:item-4:return-origin' },
					{ ms: 8800, name: 'demo:item-5:return-origin' },
				],
			},
		},
	}
}
