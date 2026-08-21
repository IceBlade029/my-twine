import {v4 as uuid} from '@lukeed/uuid';
import {rectsIntersect} from '../../../util/geometry';
import {compileVisualPassage, emptyVisualPassage} from '../../../util/visual-passage';
import {passageDefaults} from '../defaults';
import {Passage, Story, UpdateStoryAction} from '../stories.types';
import {updateStory} from './update-story';

/**
 * Marker comment that identifies the time-system engine inside the story's
 * JavaScript. The one-click creator skips appending when it is already there.
 */
export const TIME_SYSTEM_MARKER = '/* twine-time-system */';

/**
 * The SugarCube-side time engine installed into the story's JavaScript. One
 * day is split into six periods; advancing past the last period rolls over to
 * the first period of the next day. The engine drives the `day` and `period`
 * story states created alongside it, so their values stay visible in the
 * story-states panel, the simulator, and StoryInit.
 */
export const TIME_SYSTEM_ENGINE = `${TIME_SYSTEM_MARKER}
setup.time = {
	periods: ['清晨', '上午', '中午', '下午', '夜晚', '深夜'],
	advance: function (n) {
		State.variables.period += (n || 1);
		State.variables.day += Math.floor(State.variables.period / 6);
		State.variables.period = State.variables.period % 6;
	},
	current: function () {
		return this.periods[State.variables.period];
	}
};
`;

/** StoryCaption body installed by the one-click time-system creator. */
export const TIME_SYSTEM_CAPTION = '第 <<=$day>> 天 · <<=setup.time.current()>>';

/**
 * Finds an unoccupied spot for a new passage, placed below the lowest
 * existing passage and nudged rightward until it overlaps none of them.
 */
function freePlacement(
	passages: Array<Pick<Passage, 'height' | 'left' | 'top' | 'width'>>
) {
	const defs = passageDefaults();
	const gap = 25;
	const bounds = {
		height: defs.height,
		left: defs.left,
		top: Math.max(
			passages.reduce(
				(max, passage) => Math.max(max, passage.top + passage.height),
				defs.height + gap
			) + gap,
			0
		),
		width: defs.width
	};

	while (passages.some(passage => rectsIntersect(passage, bounds))) {
		bounds.left += bounds.width + gap;
	}

	return bounds;
}

/**
 * True when the story already owns the two time-system states, so re-creating
 * the system would duplicate them.
 */
export function storyHasTimeSystem(story: Story) {
	const states = story.visual?.states ?? [];

	return (
		states.some(state => state.name === 'day') &&
		states.some(state => state.name === 'period')
	);
}

/**
 * One-click time system: adds the `day` and `period` states (when missing),
 * guarantees a StoryInit passage owns the state initialization, installs the
 * time engine into the story's JavaScript (when the marker is absent), and
 * creates a StoryCaption that shows the current day and period. All visual
 * passages are recompiled so the generated text stays in sync with the new
 * states. Delivered as a single updateStory action, so the existing undo/redo
 * machinery restores the previous story wholesale.
 */
export function createTimeSystem(
	stories: Story[],
	story: Story
): UpdateStoryAction {
	const states = [...(story.visual?.states ?? [])];

	if (!states.some(state => state.name === 'day')) {
		states.push({defaultValue: 1, id: uuid(), name: 'day', type: 'number'});
	}

	if (!states.some(state => state.name === 'period')) {
		states.push({defaultValue: 0, id: uuid(), name: 'period', type: 'number'});
	}

	const passages = [...story.passages];

	if (!passages.some(passage => passage.name === 'StoryInit')) {
		passages.push({
			...passageDefaults(),
			...freePlacement(passages),
			id: uuid(),
			name: 'StoryInit',
			story: story.id,
			visual: emptyVisualPassage()
		});
	}

	if (!passages.some(passage => passage.name === 'StoryCaption')) {
		passages.push({
			...passageDefaults(),
			...freePlacement(passages),
			id: uuid(),
			name: 'StoryCaption',
			story: story.id,
			visual: {
				blocks: [{id: uuid(), kind: 'text', text: TIME_SYSTEM_CAPTION}],
				version: 2
			}
		});
	}

	const script = story.script.includes(TIME_SYSTEM_MARKER)
		? story.script
		: story.script === ''
			? TIME_SYSTEM_ENGINE
			: `${story.script}\n\n${TIME_SYSTEM_ENGINE}`;

	const nextStory: Story = {
		...story,
		passages,
		script,
		visual: {states, version: 1}
	};

	// StoryInit now exists, so recompiling visual passages puts the state
	// initialization into it (and keeps every generated text in sync).
	nextStory.passages = passages.map(passage =>
		passage.visual
			? {
					...passage,
					text: compileVisualPassage(passage.visual, nextStory, passage.id)
				}
			: passage
	);

	return updateStory(stories, story, {
		passages: nextStory.passages,
		script,
		visual: nextStory.visual
	});
}