import {fakeAppInfo, fakeStory} from '../../test-util';
import {
	VisualBinaryOperator,
	VisualBranchBlock,
	VisualChoiceBlock,
	VisualLoopBlock,
	VisualPassageContentV1,
	VisualPassageContentV2,
	VisualSwitchBlock
} from '../../store/stories';
import {importStories} from '../import';
import {publishStory} from '../publish';
import {serializeVisualEditorMetadata} from '../visual-editor-metadata';
import {compileVisualPassage} from '../visual-passage';

function cond(
	operator: VisualBinaryOperator,
	variableId: string,
	value: boolean | number | string
) {
	return {
		kind: 'binary' as const,
		operator,
		left: {kind: 'variable' as const, variableId},
		right: {kind: 'literal' as const, value}
	};
}

describe('visual editor HTML metadata', () => {
	function visualStory() {
		const story = fakeStory(2);
		const state = {
			defaultValue: false,
			id: 'met-character',
			name: 'Met character',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					condition: cond('==', state.id, false),
					id: 'text-1',
					kind: 'text',
					text: 'Hello.'
				},
				{
					branches: [
						{
							blocks: [
								{
									actions: [
										{operation: 'set', stateId: state.id, value: true}
									],
									id: 'choice-1',
									kind: 'choice',
									label: 'Continue',
									targetPassageId: story.passages[1].id
								}
							],
							condition: cond('==', state.id, true),
							id: 'branch-a'
						},
						{blocks: [], id: 'branch-else'}
					],
					id: 'branch-1',
					kind: 'branch'
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		return story;
	}

	it('round trips v2 visual passages, nested choices, and states through HTML', () => {
		const original = visualStory();
		const [restored] = importStories(
			publishStory(original, fakeAppInfo(), {startOptional: true})
		);

		expect(restored.visual).toEqual(original.visual);
		expect(restored.passages[0].text).toBe(original.passages[0].text);

		// The nested choice's target is resolved back to the imported passage id
		// (passages get fresh ids on import, so it cannot be the original id).
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;
		const restoredBranch = restoredVisual.blocks[1] as VisualBranchBlock;
		const restoredChoice = restoredBranch.branches[0]
			.blocks[0] as VisualChoiceBlock;

		expect(restoredChoice.targetPassageId).toBe(restored.passages[1].id);

		// The restored model serializes back to exactly the original metadata:
		// targets are stored by passage name, so they survive re-import.
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(original)
		);
	});

	it('round trips advance-time choice actions through HTML', () => {
		const story = fakeStory(2);

		// The time-system action works even without any story states.
		story.visual = {states: [], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					actions: [
						{operation: 'advanceTime', stateId: '', value: 3}
					],
					id: 'choice-1',
					kind: 'choice',
					label: 'Sleep',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);

		expect(restored.visual).toEqual(story.visual);
		expect(
			((restored.passages[0].visual as VisualPassageContentV2).blocks[0] as VisualChoiceBlock)
				.actions
		).toEqual([{operation: 'advanceTime', stateId: '', value: 3}]);
		expect(restored.passages[0].text).toBe(story.passages[0].text);
	});

	it('round trips count conditions in block gates through HTML', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: [],
			id: 'met-backpack',
			name: 'backpack',
			type: 'list' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					condition: {
						kind: 'binary',
						operator: '>=',
						left: {
							kind: 'count',
							variableId: state.id,
							value: '药草'
						},
						right: {kind: 'literal', value: 2}
					},
					id: 'choice-1',
					kind: 'choice',
					actions: [],
					label: '合成木弓',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);

		expect(restored.visual).toEqual(story.visual);
		expect(restored.passages[0].text).toBe(story.passages[0].text);
		expect(
			((restored.passages[0].visual as VisualPassageContentV2).blocks[0] as VisualChoiceBlock)
				.condition
		).toEqual({
			kind: 'binary',
			operator: '>=',
			left: {kind: 'count', variableId: state.id, value: '药草'},
			right: {kind: 'literal', value: 2}
		});
	});

	it('round trips variable and include blocks, remapping include targets by name', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: false,
			id: 'met-character',
			name: 'Met character',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Intro';
		story.passages[2].name = 'Extras';
		story.passages[0].visual = {
			blocks: [
				{
					condition: cond('==', state.id, true),
					id: 'var-1',
					kind: 'variable',
					stateId: state.id
				},
				{
					branches: [
						{
							blocks: [
								{
									id: 'inc-1',
									kind: 'include',
									targetPassageId: story.passages[1].id
								}
							],
							condition: cond('==', state.id, true),
							id: 'branch-a'
						},
						{blocks: [], id: 'branch-else'}
					],
					id: 'branch-1',
					kind: 'branch'
				},
				{
					id: 'inc-2',
					kind: 'include',
					targetPassageId: story.passages[2].id
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;

		// Variable blocks keep their state id directly; states are not remapped.
		expect(restoredVisual.blocks[0]).toEqual({
			condition: cond('==', state.id, true),
			id: 'var-1',
			kind: 'variable',
			stateId: state.id
		});

		// Include targets remap by passage name to the imported passage ids,
		// including an include nested inside a branch.
		const restoredBranch = restoredVisual.blocks[1] as VisualBranchBlock;

		expect(restoredBranch.branches[0].blocks[0]).toMatchObject({
			id: 'inc-1',
			kind: 'include',
			targetPassageId: restored.passages[1].id
		});
		expect(restoredVisual.blocks[2]).toMatchObject({
			id: 'inc-2',
			kind: 'include',
			targetPassageId: restored.passages[2].id
		});

		// The restored model serializes back to exactly the original metadata:
		// include targets are stored by passage name, so they survive re-import.
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(story)
		);
	});

	it('round trips interaction blocks verbatim and keeps choice special targets', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: false,
			id: 'met-character',
			name: 'Met character',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					content: 'A secret.',
					id: 'int-1',
					kind: 'interaction',
					label: 'Reveal',
					operation: 'reveal'
				},
				{
					condition: cond('==', state.id, true),
					content: 'Peek.',
					id: 'int-2',
					kind: 'interaction',
					label: 'Remove',
					operation: 'remove'
				},
				{
					actions: [{operation: 'set', stateId: state.id, value: true}],
					condition: cond('==', state.id, true),
					id: 'choice-1',
					kind: 'choice',
					label: 'Go back',
					specialTarget: 'back',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;

		// Interaction blocks hold no passage references: they survive the
		// round trip verbatim, including their condition.
		expect(restoredVisual.blocks[0]).toEqual({
			content: 'A secret.',
			id: 'int-1',
			kind: 'interaction',
			label: 'Reveal',
			operation: 'reveal'
		});
		expect(restoredVisual.blocks[1]).toEqual({
			condition: cond('==', state.id, true),
			content: 'Peek.',
			id: 'int-2',
			kind: 'interaction',
			label: 'Remove',
			operation: 'remove'
		});

		// The choice keeps its specialTarget through the round trip while its
		// passage target remaps by name to the imported passage id.
		expect(restoredVisual.blocks[2]).toEqual({
			actions: [{operation: 'set', stateId: state.id, value: true}],
			condition: cond('==', state.id, true),
			id: 'choice-1',
			kind: 'choice',
			label: 'Go back',
			specialTarget: 'back',
			targetPassageId: restored.passages[1].id
		});

		// The restored model serializes back to exactly the original metadata.
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(story)
		);
	});

	it('round trips raw blocks and loop item variable blocks verbatim', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: false,
			id: 'met-character',
			name: 'Met character',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					condition: cond('==', state.id, true),
					id: 'raw-1',
					kind: 'raw',
					sugar: '<<set $custom = $nrp_met_character>>'
				},
				{
					id: 'var-1',
					kind: 'variable',
					source: 'loopItem',
					stateId: undefined
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;

		// Raw blocks hold no passage references: they survive the round trip
		// verbatim, including their condition and unescaped sugar.
		expect(restoredVisual.blocks[0]).toEqual({
			condition: cond('==', state.id, true),
			id: 'raw-1',
			kind: 'raw',
			sugar: '<<set $custom = $nrp_met_character>>'
		});

		// Loop item variable blocks have no state: source survives verbatim.
		expect(restoredVisual.blocks[1]).toEqual({
			id: 'var-1',
			kind: 'variable',
			source: 'loopItem',
			stateId: undefined
		});

		// The restored model serializes back to exactly the original metadata.
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(story)
		);
	});

	it('round trips switch and loop blocks with nested blocks and case values', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'met-mood',
			name: 'Mood',
			type: 'number' as const
		};
		const listState = {
			defaultValue: ['a'],
			id: 'met-inv',
			name: 'Inventory',
			type: 'list' as const
		};

		story.visual = {states: [state, listState], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					cases: [
						{
							blocks: [
								{
									condition: cond('==', state.id, 1),
									id: 'var-1',
									kind: 'variable',
									stateId: state.id
								},
								{
									id: 'inc-1',
									kind: 'include',
									targetPassageId: story.passages[1].id
								}
							],
							id: 'case-1',
							value: 1
						},
						{blocks: [], id: 'case-2', value: 'fallback'}
					],
					defaultBlocks: [
						{id: 'text-d', kind: 'text', text: 'Default.'}
					],
					id: 'switch-1',
					kind: 'switch',
					stateId: state.id
				},
				{
					blocks: [
						{
							id: 'var-loop',
							kind: 'variable',
							source: 'loopItem',
							stateId: undefined
						}
					],
					id: 'loop-1',
					kind: 'loop',
					stateId: listState.id
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;
		const restoredSwitch = restoredVisual.blocks[0] as VisualSwitchBlock;
		const restoredLoop = restoredVisual.blocks[1] as VisualLoopBlock;

		// Switch and loop state ids are stored verbatim; states are not remapped.
		expect(restoredSwitch.stateId).toBe(state.id);
		expect(restoredSwitch.cases).toEqual([
			{
				blocks: [
					{
						condition: cond('==', state.id, 1),
						id: 'var-1',
						kind: 'variable',
						stateId: state.id
					},
					{
						id: 'inc-1',
						kind: 'include',
						targetPassageId: restored.passages[1].id
					}
				],
				id: 'case-1',
				value: 1
			},
			{blocks: [], id: 'case-2', value: 'fallback'}
		]);
		expect(restoredSwitch.defaultBlocks).toEqual([
			{id: 'text-d', kind: 'text', text: 'Default.'}
		]);
		expect(restoredLoop.stateId).toBe(listState.id);
		expect(restoredLoop.blocks).toEqual([
			{id: 'var-loop', kind: 'variable', source: 'loopItem', stateId: undefined}
		]);

		// The restored model serializes back to exactly the original metadata:
		// the nested include target remaps by name and case values stay verbatim.
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(story)
		);
	});

	it('restores legacy v1 metadata by migrating it to v2', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: false,
			id: 'met-character',
			name: 'Met character',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		const v1: VisualPassageContentV1 = {
			body: 'Hello.',
			bodyCondition: cond('==', state.id, false),
			choices: [
				{
					actions: [{operation: 'set', stateId: state.id, value: true}],
					id: 'choice-1',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 1
		};
		story.passages[0].visual = v1;
		story.passages[0].text = compileVisualPassage(
			v1,
			story,
			story.passages[0].id
		);
		const html = publishStory(story, fakeAppInfo(), {startOptional: true});
		const legacyMetadata = JSON.stringify({
			passages: {
				Start: {
					body: v1.body,
					bodyCondition: v1.bodyCondition,
					choices: v1.choices.map(choice => ({
						id: choice.id,
						label: choice.label,
						condition: choice.condition,
						actions: choice.actions,
						targetPassageName: 'Next'
					})),
					generatedText: story.passages[0].text,
					version: 1
				}
			},
			story: {states: [state], version: 1},
			version: 1
		})
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e');
		const [restored] = importStories(
			html.replace(
				/("data-narrative-editor">)[\s\S]*?(<\/script>)/,
				`$1${legacyMetadata}$2`
			)
		);

		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;

		expect(restoredVisual.version).toBe(2);
		expect(restoredVisual.blocks).toHaveLength(2);
		expect(restoredVisual.blocks[0]).toMatchObject({
			condition: v1.bodyCondition,
			kind: 'text',
			text: 'Hello.'
		});
		expect(restoredVisual.blocks[1]).toEqual({
			actions: [{operation: 'set', stateId: state.id, value: true}],
			condition: undefined,
			id: 'choice-1',
			kind: 'choice',
			label: 'Continue',
			targetPassageId: restored.passages[1].id
		});
	});

	it('falls back to source mode if generated passage text was edited externally', () => {
		const original = visualStory();
		const html = publishStory(original, fakeAppInfo(), {startOptional: true});
		const bodyIndex = html.lastIndexOf('Hello.');
		const modified =
			html.slice(0, bodyIndex) +
			'Externally edited.' +
			html.slice(bodyIndex + 'Hello.'.length);
		const [restored] = importStories(modified);

		expect(restored.passages[0].visual).toBeUndefined();
		expect(restored.passages[0].text).toContain('Externally edited.');
	});

	it('ignores unsupported metadata versions', () => {
		const original = visualStory();
		const html = publishStory(original, fakeAppInfo(), {startOptional: true});
		const modified = html.replace('"version":1', '"version":99');
		const [restored] = importStories(modified);

		expect(restored.passages[0].visual).toBeUndefined();
	});

	it('round trips expression and set blocks verbatim', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'met-trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';
		story.passages[0].visual = {
			blocks: [
				{
					condition: cond('>=', state.id, 2),
					id: 'text-1',
					kind: 'text',
					text: 'Above.'
				},
				{
					condition: cond('>', state.id, 0),
					id: 'set-1',
					kind: 'set',
					operation: '+=',
					variableId: state.id,
					value: {
						kind: 'binary',
						operator: '+',
						left: {kind: 'free', code: '$Trust'},
						right: {kind: 'literal', value: 1}
					}
				}
			],
			version: 2
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story,
			story.passages[0].id
		);
		const [restored] = importStories(
			publishStory(story, fakeAppInfo(), {startOptional: true})
		);
		const restoredVisual = restored.passages[0]
			.visual as VisualPassageContentV2;

		expect(restoredVisual.blocks).toEqual(story.passages[0].visual?.blocks);
		expect(restored.passages[0].text).toBe(story.passages[0].text);
		expect(serializeVisualEditorMetadata(restored)).toEqual(
			serializeVisualEditorMetadata(story)
		);
	});
});
