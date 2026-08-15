import {fakeAppInfo, fakeStory} from '../../test-util';
import {
	VisualBranchBlock,
	VisualChoiceBlock,
	VisualPassageContentV1,
	VisualPassageContentV2
} from '../../store/stories';
import {importStories} from '../import';
import {publishStory} from '../publish';
import {serializeVisualEditorMetadata} from '../visual-editor-metadata';
import {compileVisualPassage} from '../visual-passage';

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
					condition: {operator: 'equals', stateId: state.id, value: false},
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
							condition: {
								operator: 'equals',
								stateId: state.id,
								value: true
							},
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
					condition: {operator: 'equals', stateId: state.id, value: true},
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
							condition: {
								operator: 'equals',
								stateId: state.id,
								value: true
							},
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
			condition: {operator: 'equals', stateId: state.id, value: true},
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
			bodyCondition: {operator: 'equals', stateId: state.id, value: false},
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
});
