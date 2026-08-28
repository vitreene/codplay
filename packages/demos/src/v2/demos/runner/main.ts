import type { SceneDoc } from 'codplay/scene/types';

const MOVE_START_MS = 800;
const MOVE_DURATION_MS = 1400;

/** Total duration owned by the runner validation scenes. */
export const SCENE_DURATION_MS = 3_000;

/** Returns the declarative scene used to validate nested FLIP reparenting. */
export function createNestedFlipScene(): SceneDoc {
	return {
		id: 'html-runner-nested-flip',
		stories: {
			main: {
				id: 'main',
				persos: [
					{
						id: 'nested-stage',
						type: 'layout',
						initial: {
							move: '@root',
							markup:
								'<div class="runner-stage__canvas"><div class="runner-stage__panel" data-part="nested-source-panel"></div><div class="runner-stage__panel" data-part="nested-target-panel"></div></div>',
						},
						actions: {},
					},
					{
						id: 'nested-source-layout',
						type: 'layout',
						initial: {
							move: { target: 'nested-source-panel' },
							markup:
								'<section class="flip-box flip-box--source nested-flip-stage"><span class="flip-box__tag">CONTENEUR SOURCE</span><h2>ÉTAT FIRST</h2><div class="flip-box__outlet nested-flip-stage__outlet" data-part="source-outlet"></div></section>',
						},
						actions: {},
					},
					{
						id: 'nested-target-layout',
						type: 'layout',
						initial: {
							move: { target: 'nested-target-panel' },
							markup:
								'<section class="flip-box flip-box--target nested-flip-stage"><span class="flip-box__tag">CONTENEUR CIBLE</span><h2>ÉTAT LAST</h2><div class="flip-box__outlet" data-part="target-outlet"></div></section>',
						},
						actions: {},
					},
					{
						id: 'nested-target-list',
						type: 'list',
						initial: {
							tag: 'section',
							move: { target: 'target-outlet' },
							className: 'flip-list flip-list--nested',
						},
						actions: {},
					},
					{
						id: 'nested-parent',
						type: 'layout',
						initial: {
							move: { target: 'source-outlet' },
							markup:
								'<article class="nested-flip-parent"><span class="nested-flip-parent__label">PARENT P</span><div class="nested-flip-parent__outlet" data-part="parent-outlet-a"></div><div class="nested-flip-parent__outlet nested-flip-parent__outlet--last" data-part="parent-outlet-b"></div></article>',
						},
						actions: {
							transfer: {
								move: {
									target: 'nested-target-list',
									mode: 'first',
									transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
								},
							},
						},
					},
					{
						id: 'nested-child',
						type: 'tag',
						initial: {
							tag: 'div',
							move: { target: 'parent-outlet-a' },
							className: 'nested-flip-child',
							content: 'ENFANT Q',
						},
						actions: {
							transfer: {
								move: {
									target: 'parent-outlet-b',
									transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
								},
							},
						},
					},
					{
						id: 'nested-b',
						type: 'tag',
						initial: {
							tag: 'article',
							move: { target: 'nested-target-list' },
							className: 'flip-item flip-item--b',
							content: 'FRÈRE B',
						},
						actions: {},
					},
					{
						id: 'nested-c',
						type: 'tag',
						initial: {
							tag: 'article',
							move: { target: 'nested-target-list' },
							className: 'flip-item flip-item--c',
							content: 'FRÈRE C',
						},
						actions: {},
					},
				],
				listen: [],
				eventimes: [{ name: 'transfer', startAt: MOVE_START_MS }],
			},
		},
	};
}
