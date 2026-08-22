import {Story} from '../../stories.types';
import {fakeStory} from '../../../../test-util';
import {compileVisualPassage, emptyVisualPassage} from '../../../../util/visual-passage';
import {passageDefaults} from '../../defaults';
import {
	createTimeSystem,
	storyHasTimeSystem,
	TIME_SYSTEM_CAPTION,
	TIME_SYSTEM_ENGINE,
	TIME_SYSTEM_MARKER
} from '../create-time-system';

describe('createTimeSystem', () => {
	function applyAction(story: Story) {
		const action = createTimeSystem([story], story);

		expect(action.type).toBe('updateStory');
		expect(action.storyId).toBe(story.id);
		expect(action.props.passages).toBeDefined();
		expect(action.props.script).toBeDefined();
		expect(action.props.visual).toBeDefined();
		return {
			passages: action.props.passages!,
			script: action.props.script!,
			visual: action.props.visual!
		};
	}

	it('adds the day and period states with the right defaults', () => {
		const story = fakeStory(1);
		const {visual} = applyAction(story);

		expect(visual.states).toHaveLength(2);
		expect(visual.states).toEqual(
			expect.arrayContaining([
				expect.objectContaining({defaultValue: 1, name: 'day', type: 'number'}),
				expect.objectContaining({defaultValue: 0, name: 'period', type: 'number'})
			])
		);
	});

	it('keeps existing states and only appends the missing time states', () => {
		const story = fakeStory(1);

		story.visual = {
			states: [
				{defaultValue: 0, id: 'trust', name: 'Trust', type: 'number'}
			],
			version: 1
		};
		const {visual} = applyAction(story);

		expect(visual.states).toHaveLength(3);
		expect(visual.states[0]).toMatchObject({name: 'Trust'});
	});

	it('installs the time engine into the story JavaScript', () => {
		const story = fakeStory(1);

		story.script = '';
		expect(applyAction(story).script).toBe(TIME_SYSTEM_ENGINE);
		expect(TIME_SYSTEM_ENGINE).toContain(TIME_SYSTEM_MARKER);
	});

	it('advances across midnight with the real installed engine', () => {
		const setup: {time?: {advance: (count: number) => void; current: () => string}} = {};
		const State = {variables: {day: 1, period: 5}};

		new Function('setup', 'State', TIME_SYSTEM_ENGINE)(setup, State);
		setup.time!.advance(2);

		expect(State.variables).toEqual({day: 2, period: 1});
		expect(setup.time!.current()).toBe('上午');
	});

	it('appends the engine after existing story JavaScript', () => {
		const story = fakeStory(1);

		story.script = 'var existing = true;';
		expect(applyAction(story).script).toBe(
			`var existing = true;\n\n${TIME_SYSTEM_ENGINE}`
		);
	});

	it('does not duplicate the engine when the marker is already present', () => {
		const story = fakeStory(1);

		story.script = `${TIME_SYSTEM_MARKER}\nsetup.time = {};`;
		expect(applyAction(story).script).toBe(story.script);
	});

	it('creates StoryInit, StoryCaption, and compiles the initialization in', () => {
		const story = fakeStory(1);

		story.passages[0].visual = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};
		const {passages, visual} = applyAction(story);
		const init = passages.find(passage => passage.name === 'StoryInit');
		const caption = passages.find(passage => passage.name === 'StoryCaption');

		expect(init).toBeDefined();
		expect(caption).toBeDefined();
		expect(init!.visual).toEqual(emptyVisualPassage());
		expect(caption!.visual).toEqual({
			blocks: [{id: expect.any(String), kind: 'text', text: TIME_SYSTEM_CAPTION}],
			version: 2
		});

		// The existing visual passage text is recompiled against the new states
		// and StoryInit owns the initialization block.
		expect(init!.text).toContain('<<if ndef $day>><<set $day = 1>><</if>>');
		expect(init!.text).toContain('<<if ndef $period>><<set $period = 0>><</if>>');
		expect(
			compileVisualPassage(
				story.passages[0].visual,
				{...story, passages, visual},
				story.passages[0].id
			)
		).toBe(passages.find(p => p.id === story.passages[0].id)!.text);
	});

	it('keeps custom StoryInit source and appends guarded initialization', () => {
		const story = fakeStory(1);

		story.passages.push({
			...passageDefaults(),
			id: 'existing-init',
			left: 500,
			name: 'StoryInit',
			story: story.id,
			text: 'custom init',
			top: 500,
			visual: undefined
		});
		const {passages} = applyAction(story);

		expect(passages.filter(p => p.name === 'StoryInit')).toHaveLength(1);
		expect(passages.find(p => p.name === 'StoryInit')!.text).toContain('custom init');
		expect(passages.find(p => p.name === 'StoryInit')!.text).toContain(
			'<<if ndef $day>>'
		);
	});

	it('does not recreate states when the system already exists', () => {
		const story = fakeStory(1);

		story.visual = {
			states: [
				{defaultValue: 1, id: 'day', name: 'day', type: 'number'},
				{defaultValue: 0, id: 'period', name: 'period', type: 'number'}
			],
			version: 1
		};
		expect(storyHasTimeSystem(story)).toBe(false);
		const result = applyAction(story);
		expect(result.visual.states).toHaveLength(2);
		expect(
			storyHasTimeSystem({...story, ...result})
		).toBe(true);
	});

	it('reports when the time-system states are missing', () => {
		expect(storyHasTimeSystem(fakeStory(1))).toBe(false);
	});
});
