import {fakePassage, fakeStory} from '../../test-util';
import {
	VisualPassageContentV1,
	VisualPassageContentV2
} from '../../store/stories';
import {
	compileVisualPassage,
	emptyVisualPassage,
	migrateVisualContent,
	passageUsesVisualEditor
} from '../visual-passage';

describe('visual passage utilities', () => {
	it('creates empty visual passage content', () => {
		expect(emptyVisualPassage()).toEqual({blocks: [], version: 2});
	});

	it('compiles text and complete choices into SugarCube source', () => {
		const story = fakeStory(2);

		story.passages[0].name = 'Start';
		story.passages[1].name = 'Hallway';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'text-1', kind: 'text', text: 'A quiet room.'},
						{
							actions: [],
							id: 'choice-1',
							kind: 'choice',
							label: 'Leave',
							targetPassageId: story.passages[1].id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('A quiet room.\n\n[[Leave->Hallway]]');
	});

	it('does not compile incomplete choices or empty text', () => {
		const story = fakeStory(1);

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'text-1', kind: 'text', text: '   '},
						{
							actions: [],
							id: 'choice-1',
							kind: 'choice',
							label: '',
							targetPassageId: story.passages[0].id
						},
						{
							actions: [],
							id: 'choice-2',
							kind: 'choice',
							label: 'Leave',
							targetPassageId: ''
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('detects visual and source passages', () => {
		expect(
			passageUsesVisualEditor(
				fakePassage({visual: {blocks: [], version: 2}})
			)
		).toBe(true);
		expect(
			passageUsesVisualEditor(
				fakePassage({visual: {body: '', choices: [], version: 1}})
			)
		).toBe(true);
		expect(passageUsesVisualEditor(fakePassage({visual: undefined}))).toBe(
			false
		);
	});

	it('compiles state initialization, conditions, and actions', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: {operator: 'greaterThan', stateId: state.id, value: 2},
					id: 'text-1',
					kind: 'text',
					text: 'Trusted.'
				},
				{
					actions: [{operation: 'increase', stateId: state.id, value: 1}],
					condition: {operator: 'equals', stateId: state.id, value: 3},
					id: 'choice-1',
					kind: 'choice',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].visual = content;
		const startSource = compileVisualPassage(
			content,
			story,
			story.passages[0].id
		);

		expect(startSource).toContain('<<if ndef $nrp_trust>>');
		expect(startSource).toContain('<<if $nrp_trust gt 2>>Trusted.<</if>>');
		expect(startSource).toContain(
			'<<if $nrp_trust is 3>>[[Continue->Next][$nrp_trust += 1]]<</if>>'
		);

		const nextContent = emptyVisualPassage();

		story.passages[1].visual = nextContent;
		expect(
			compileVisualPassage(
				nextContent,
				story,
				story.passages[1].id
			)
		).not.toContain('<<if ndef $nrp_trust>>');
	});

	it('compiles nested branches with conditions and an else branch', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: 0,
			id: 's',
			name: 'S',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Ending A';
		story.passages[2].name = 'Ending B';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							branches: [
								{
									blocks: [
										{
											actions: [],
											id: 'choice-a',
											kind: 'choice',
											label: 'Go to A',
											targetPassageId: story.passages[1].id
										}
									],
									condition: {
										operator: 'equals',
										stateId: state.id,
										value: 1
									},
									id: 'branch-a'
								},
								{
									blocks: [
										{id: 'text-b', kind: 'text', text: 'Fallback text.'}
									],
									id: 'branch-else'
								}
							],
							id: 'branch-1',
							kind: 'branch'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if $nrp_s is 1>>[[Go to A->Ending A]]<<else>>Fallback text.<</if>>'
		);
	});

	it('emits initialization based on the passage id, not content identity', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		// The owner: the start passage with visual content.
		story.passages[0].visual = emptyVisualPassage();
		story.passages[1].visual = emptyVisualPassage();
		// A freshly created content object that is NOT the stored reference.
		const fresh: VisualPassageContentV2 = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};

		// The fix: initialization is emitted for the owner passage even when the
		// content object was just created.
		expect(
			compileVisualPassage(fresh, story, story.passages[0].id)
		).toContain('<<if ndef $nrp_trust>>');

		// A non-owner passage id must not emit initialization.
		expect(
			compileVisualPassage(fresh, story, story.passages[1].id)
		).not.toContain('<<if ndef $nrp_trust>>');
	});

	it('migrates v1 content to v2 losslessly and is idempotent', () => {
		const v1: VisualPassageContentV1 = {
			body: 'Hello.',
			bodyCondition: {operator: 'equals', stateId: 's1', value: true},
			choices: [
				{
					actions: [],
					condition: {operator: 'notEquals', stateId: 's1', value: false},
					id: 'choice-1',
					label: 'Leave',
					targetPassageId: 'passage-2'
				}
			],
			version: 1
		};
		const migrated = migrateVisualContent(v1);

		expect(migrated.version).toBe(2);
		expect(migrated.blocks).toHaveLength(2);
		expect(migrated.blocks[0]).toMatchObject({
			condition: v1.bodyCondition,
			kind: 'text',
			text: 'Hello.'
		});
		expect(migrated.blocks[1]).toEqual({
			actions: [],
			condition: {operator: 'notEquals', stateId: 's1', value: false},
			id: 'choice-1',
			kind: 'choice',
			label: 'Leave',
			targetPassageId: 'passage-2'
		});

		// An empty v1 passage becomes an empty block list.
		expect(migrateVisualContent({body: '', choices: [], version: 1})).toEqual(
			{blocks: [], version: 2}
		);

		// A v1 body without choices still becomes a single text block.
		expect(
			migrateVisualContent({body: 'Only text.', choices: [], version: 1})
				.blocks
		).toMatchObject([
			{condition: undefined, kind: 'text', text: 'Only text.'}
		]);
	});

	it('returns v2 content unchanged from migration', () => {
		const v2: VisualPassageContentV2 = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};

		expect(migrateVisualContent(v2)).toBe(v2);
	});
});
