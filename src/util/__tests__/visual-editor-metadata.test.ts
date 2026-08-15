import {fakeAppInfo, fakeStory} from '../../test-util';
import {importStories} from '../import';
import {publishStory} from '../publish';
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
			body: 'Hello.',
			bodyCondition: {operator: 'equals', stateId: state.id, value: false},
			choices: [
				{
					actions: [
						{operation: 'set', stateId: state.id, value: true}
					],
					id: 'choice-1',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 1
		};
		story.passages[0].text = compileVisualPassage(
			story.passages[0].visual,
			story
		);
		return story;
	}

	it('round trips visual passages, target references, and states through HTML', () => {
		const original = visualStory();
		const [restored] = importStories(
			publishStory(original, fakeAppInfo(), {startOptional: true})
		);

		expect(restored.visual).toEqual(original.visual);
		expect(restored.passages[0].visual?.body).toBe('Hello.');
		expect(restored.passages[0].visual?.choices[0].targetPassageId).toBe(
			restored.passages[1].id
		);
		expect(restored.passages[0].text).toBe(original.passages[0].text);
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
