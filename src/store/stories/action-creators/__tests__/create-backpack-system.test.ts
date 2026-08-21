import {Story} from '../../stories.types';
import {fakeStory} from '../../../../test-util';
import {compileVisualPassage, emptyVisualPassage} from '../../../../util/visual-passage';
import {passageDefaults} from '../../defaults';
import {
	BACKPACK_MENU_LINK,
	BACKPACK_PASSAGE_NAME,
	BACKPACK_STATE_NAME,
	createBackpackSystem,
	storyHasBackpackSystem
} from '../create-backpack-system';

describe('createBackpackSystem', () => {
	function applyAction(story: Story) {
		const action = createBackpackSystem([story], story);

		expect(action.type).toBe('updateStory');
		expect(action.storyId).toBe(story.id);
		expect(action.props.passages).toBeDefined();
		expect(action.props.visual).toBeDefined();
		return {
			passages: action.props.passages!,
			visual: action.props.visual!
		};
	}

	function backpackVisual(story: Story) {
		const {passages, visual} = applyAction(story);
		const backpack = passages.find(p => p.name === BACKPACK_PASSAGE_NAME);

		expect(backpack).toBeDefined();
		return {backpack: backpack!, passages, visual};
	}

	it('adds the backpack list state with an empty default', () => {
		const story = fakeStory(1);
		const {visual} = applyAction(story);

		expect(visual.states).toEqual([
			expect.objectContaining({
				defaultValue: [],
				name: BACKPACK_STATE_NAME,
				type: 'list'
			})
		]);
	});

	it('creates a backpack passage that loops every item one row at a time', () => {
		const story = fakeStory(1);
		const {backpack, visual} = backpackVisual(story);
		const backpackState = visual.states.find(
			state => state.name === BACKPACK_STATE_NAME
		)!;

		expect(backpack.visual).toEqual({
			blocks: [
				{id: expect.any(String), kind: 'text', text: '背包：'},
				{
					id: expect.any(String),
					kind: 'loop',
					stateId: backpackState.id,
					blocks: [
						{
							id: expect.any(String),
							kind: 'variable',
							source: 'loopItem',
							stateId: undefined
						}
					]
				}
			],
			version: 2
		});
		expect(backpack.text).toBe('背包：\n\n<<for _item range $backpack>><<print _item>><</for>>');
	});

	it('creates StoryInit and compiles the backpack initialization in', () => {
		const story = fakeStory(1);
		const {passages} = applyAction(story);
		const init = passages.find(p => p.name === 'StoryInit');

		expect(init).toBeDefined();
		expect(init!.visual).toEqual(emptyVisualPassage());
		expect(init!.text).toContain(
			'<<if ndef $backpack>><<set $backpack = []>><</if>>'
		);
	});

	it('creates a StoryMenu entry linking to the backpack passage', () => {
		const story = fakeStory(1);
		const {passages} = applyAction(story);
		const menu = passages.find(p => p.name === 'StoryMenu');

		expect(menu).toBeDefined();
		expect(menu!.text).toContain(BACKPACK_MENU_LINK);
	});

	it('appends the menu link to an existing StoryMenu', () => {
		const story = fakeStory(1);

		story.passages.push({
			...passageDefaults(),
			id: 'existing-menu',
			left: 400,
			name: 'StoryMenu',
			story: story.id,
			text: '[[帮助->帮助]]',
			top: 400,
			visual: undefined
		});
		const {passages} = applyAction(story);
		const menu = passages.find(p => p.name === 'StoryMenu')!;

		expect(menu.text).toContain('[[帮助->帮助]]');
		expect(menu.text).toContain(BACKPACK_MENU_LINK);

		// The link is not duplicated on a second run.
		const second = createBackpackSystem([story], story);
		const menu2 = second.props.passages!.find(p => p.name === 'StoryMenu')!;
		expect(menu2.text.match(/\[\[背包->背包\]\]/g)!.length).toBe(1);
	});

	it('keeps an existing backpack state and passage instead of duplicating', () => {
		const story = fakeStory(1);

		story.visual = {
			states: [
				{defaultValue: [], id: 'bp', name: BACKPACK_STATE_NAME, type: 'list'}
			],
			version: 1
		};
		story.passages.push({
			...passageDefaults(),
			id: 'bp-passage',
			left: 400,
			name: BACKPACK_PASSAGE_NAME,
			story: story.id,
			text: 'custom backpack text',
			top: 400,
			visual: undefined
		});
		const {passages, visual} = applyAction(story);

		expect(storyHasBackpackSystem(story)).toBe(true);
		expect(visual.states).toHaveLength(1);
		expect(passages.filter(p => p.name === BACKPACK_PASSAGE_NAME)).toHaveLength(
			1
		);
		expect(
			passages.find(p => p.name === BACKPACK_PASSAGE_NAME)!.text
		).toBe('custom backpack text');
	});

	it('recompiles existing visual passages against the new state', () => {
		const story = fakeStory(1);

		story.passages[0].visual = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};
		const {passages} = applyAction(story);
		const start = passages.find(p => p.id === story.passages[0].id)!;

		expect(
			compileVisualPassage(
				story.passages[0].visual,
				{...story, passages},
				story.passages[0].id
			)
		).toBe(start.text);
	});

	it('reports when the backpack state is missing', () => {
		expect(storyHasBackpackSystem(fakeStory(1))).toBe(false);
	});
});