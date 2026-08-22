import {createSpecialPassage} from '../create-special-passage';
import {Story} from '../../stories.types';
import {fakeStory} from '../../../../test-util';
import {passageDefaults} from '../../defaults';

describe('createSpecialPassage', () => {
	const defs = passageDefaults();
	let story: Story;

	beforeEach(() => {
		story = fakeStory(2);
		story.passages[0].name = 'mock-passage-1';
		story.passages[0].top = 0;
		story.passages[0].height = 100;
		story.passages[1].name = 'mock-passage-2';
		story.passages[1].top = 100;
		story.passages[1].height = 100;
	});

	it('creates a passage with the exact special name', () => {
		const action = createSpecialPassage(story, 'StoryInit');

		expect(action.type).toBe('createPassage');
		expect(action.storyId).toBe(story.id);
		expect(action.props.name).toBe('StoryInit');
		expect(action.props.visual).toEqual({blocks: [], version: 2});
		expect(action.props.story).toBe(story.id);
	});

	it('creates an empty visual passage', () => {
		const action = createSpecialPassage(story, 'StoryCaption');

		expect(action.props.visual).toEqual({blocks: [], version: 2});
	});

	it('creates StoryInterface as raw HTML with the required passages mount', () => {
		const action = createSpecialPassage(story, 'StoryInterface');

		expect(action.props.visual).toBeUndefined();
		expect(action.props.text).toBe(
			'<div id="passages" aria-live="polite"></div>'
		);
	});

	it('places the passage below the lowest existing passage', () => {
		const action = createSpecialPassage(story, 'StoryMenu');

		expect(action.props.top).toBeGreaterThanOrEqual(
			Math.max(...story.passages.map(p => p.top + p.height)) + defs.top
		);
	});

	it('places a passage at the origin when there are no passages', () => {
		story.passages = [];
		const action = createSpecialPassage(story, 'StoryInit');

		expect(action.props.top).toBeGreaterThanOrEqual(0);
		expect(action.props.left).toBeGreaterThanOrEqual(0);
	});

	it('gives passages distinct ids', () => {
		const action1 = createSpecialPassage(story, 'StoryInit');
		const action2 = createSpecialPassage(story, 'StoryCaption');

		expect(action1.props.id).not.toBe(action2.props.id);
	});
});
