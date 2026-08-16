import {fakeStory} from '../../test-util';
import {buildTestHtml} from '../test-run';

describe('buildTestHtml()', () => {
	function visualStory(passageCount = 2) {
		const story = fakeStory(passageCount);

		story.passages[0].name = 'Start';
		story.passages[0].visual = {
			blocks: [
				{id: 'text-1', kind: 'text', text: 'Hello.'},
				{
					id: 'set-1',
					kind: 'set',
					operation: '=',
					variableId: 'trust',
					value: {kind: 'literal', value: 7}
				}
			],
			version: 2
		};
		story.passages[1].name = 'Hallway';
		story.startPassage = story.passages[0].id;
		story.visual = {
			states: [
				{defaultValue: 0, id: 'trust', name: 'Trust', type: 'number'}
			],
			version: 1
		};

		return story;
	}

	it('publishes a complete document with the injected test harness', () => {
		const story = visualStory();
		const html = buildTestHtml(story, story.passages[0].id, {Trust: 5});

		expect(typeof html).toBe('string');
		// It is a standalone HTML document ending in </body>.
		expect(html).toContain('</body>');
		expect(html).toContain('<tw-storydata');
		// The injected harness is present and listens for the passage start and
		// end events, then posts back to the parent window.
		expect(html).toContain('narrative-test-result');
		expect(html).toContain('narrative-test-error');
		expect(html).toContain('window.__trace');
		expect(html).toContain(':passagestart');
		expect(html).toContain(':passageend');
		expect(html).toContain('before');
		expect(html).toContain('after');
		expect(html).toContain('window.parent.postMessage');
		// The startnode points at the passage under test (pid 1).
		expect(html).toContain('startnode="1"');
	});

	it('embeds the story-state variable names and the state overrides', () => {
		const story = visualStory();
		const html = buildTestHtml(
			story,
			story.passages[0].id,
			{Trust: 5, Inventory: ['key']}
		);

		// Sanitized state variable names are in the harness snapshot scope.
		expect(html).toContain('"Trust"');
		// The overrides are injected as <<set>> macros into the story data
		// (this story has no StoryInit, so they prepend the target passage;
		// publishPassage HTML-escapes angle brackets and quotes).
		expect(html).toContain('$Trust = 5');
		expect(html).toContain('$Inventory = [&quot;key&quot;]');
	});

	it('embeds trace markers for visual passages (compiled with trace mode)', () => {
		const story = visualStory();
		const html = buildTestHtml(story, story.passages[0].id, {});

		// The block start/end markers, HTML-escaped inside the story data
		// (publishPassage escapes quotes and angle brackets).
		expect(html).toContain(
			'window.__trace.push({b:&quot;text-1&quot;,ev:&quot;s&quot;})'
		);
		expect(html).toContain(
			'window.__trace.push({b:&quot;text-1&quot;,ev:&quot;e&quot;})'
		);
		expect(html).toContain(
			'window.__trace.push({b:&quot;set-1&quot;,ev:&quot;s&quot;})'
		);
	});

	it('throws when the passage under test does not exist', () => {
		const story = visualStory();

		expect(() => buildTestHtml(story, 'missing-id', {})).toThrow(
			'missing-id'
		);
	});

	it('leaves non-visual stories intact and still injects the harness', () => {
		const plain = fakeStory(1);

		// Ensure the passage has no visual data.
		plain.passages[0].visual = undefined;
		plain.visual = undefined;
		const html = buildTestHtml(plain, plain.passages[0].id, {});

		expect(html).toContain('</body>');
		expect(html).toContain('narrative-test-result');
		// No trace markers when there are no visual passages.
		expect(html).not.toContain('window.__trace.push({b:');
	});
});
