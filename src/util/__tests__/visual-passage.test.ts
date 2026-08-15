import {fakePassage, fakeStory} from '../../test-util';
import {VisualPassageContentV1} from '../../store/stories';
import {
	compileVisualPassage,
	emptyVisualPassage,
	passageUsesVisualEditor
} from '../visual-passage';

describe('visual passage utilities', () => {
	it('creates empty visual passage content', () => {
		expect(emptyVisualPassage()).toEqual({body: '', choices: [], version: 1});
	});

	it('compiles body and complete choices into SugarCube source', () => {
		const story = fakeStory(2);

		story.passages[0].name = 'Start';
		story.passages[1].name = 'Hallway';

		expect(
			compileVisualPassage(
				{
					body: 'A quiet room.',
					choices: [
						{
							actions: [],
							id: 'choice-1',
							label: 'Leave',
							targetPassageId: story.passages[1].id
						}
					],
					version: 1
				},
				story
			)
		).toBe('A quiet room.\n\n[[Leave->Hallway]]');
	});

	it('does not compile incomplete choices', () => {
		const story = fakeStory(1);

		expect(
			compileVisualPassage(
				{
					body: '',
					choices: [
						{actions: [], id: 'choice-1', label: '', targetPassageId: story.passages[0].id},
						{actions: [], id: 'choice-2', label: 'Leave', targetPassageId: ''}
					],
					version: 1
				},
				story
			)
		).toBe('');
	});

	it('detects visual and source passages', () => {
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
		const content: VisualPassageContentV1 = {
			body: 'Trusted.',
			bodyCondition: {operator: 'greaterThan', stateId: state.id, value: 2},
			choices: [
				{
					actions: [{operation: 'increase', stateId: state.id, value: 1}],
					condition: {operator: 'equals', stateId: state.id, value: 3},
					id: 'choice',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 1
		};
		story.passages[0].visual = content;
		const startSource = compileVisualPassage(content, story);

		expect(startSource).toContain('<<if ndef $nrp_trust>>');
		expect(startSource).toContain(
			'<<if $nrp_trust is 3>>[[Continue->Next][$nrp_trust += 1]]<</if>>'
		);

		const nextContent = emptyVisualPassage();
		story.passages[1].visual = nextContent;
		expect(compileVisualPassage(nextContent, story)).not.toContain(
			'<<if ndef $nrp_trust>>'
		);
	});
});
