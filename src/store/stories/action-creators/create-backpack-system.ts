import {v4 as uuid} from '@lukeed/uuid';
import {rectsIntersect} from '../../../util/geometry';
import {
	compileVisualPassage,
	emptyVisualPassage,
	migrateVisualContent
} from '../../../util/visual-passage';
import {passageDefaults} from '../defaults';
import {
	Passage,
	Story,
	UpdateStoryAction,
	VisualPassageContentV2
} from '../stories.types';
import {updateStory} from './update-story';

/** The backpack list state name used by the one-click creator and item templates. */
export const BACKPACK_STATE_NAME = 'backpack';

/** The passage that renders the backpack contents. */
export const BACKPACK_PASSAGE_NAME = '背包';

/** StoryMenu link installed by the one-click creator. */
export const BACKPACK_MENU_LINK = '[[背包->背包]]';

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

/** True when the story already owns the backpack state. */
export function storyHasBackpackSystem(story: Story) {
	return (story.visual?.states ?? []).some(
		state => state.name === BACKPACK_STATE_NAME
	);
}

/** The visual blocks of the「背包」passage: a heading and one row per item. */
function backpackPassageBlocks(
	backpackStateId: string
): VisualPassageContentV2 {
	return {
		blocks: [
			{id: uuid(), kind: 'text' as const, text: '背包：'},
			{
				id: uuid(),
				kind: 'loop' as const,
				stateId: backpackStateId,
				blocks: [
					{
						id: uuid(),
						kind: 'variable' as const,
						source: 'loopItem' as const,
						stateId: undefined
					}
				]
			}
		],
		version: 2
	};
}

/**
 * One-click backpack system: adds the `backpack` list state (when missing),
 * guarantees a StoryInit passage owns the state initialization, creates the
 *「背包」passage that renders every item one row at a time (duplicates repeat),
 * and installs a StoryMenu entry linking to it. All visual passages are
 * recompiled so the generated text stays in sync. Delivered as a single
 * updateStory action, so the existing undo/redo machinery restores the
 * previous story wholesale.
 */
export function createBackpackSystem(
	stories: Story[],
	story: Story
): UpdateStoryAction {
	const states = [...(story.visual?.states ?? [])];
	const existingBackpack = states.find(
		state => state.name === BACKPACK_STATE_NAME
	);
	const backpackStateId = existingBackpack?.id ?? uuid();

	if (!existingBackpack) {
		states.push({
			defaultValue: [],
			id: backpackStateId,
			name: BACKPACK_STATE_NAME,
			type: 'list'
		});
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

	if (!passages.some(passage => passage.name === BACKPACK_PASSAGE_NAME)) {
		passages.push({
			...passageDefaults(),
			...freePlacement(passages),
			id: uuid(),
			name: BACKPACK_PASSAGE_NAME,
			story: story.id,
			visual: backpackPassageBlocks(backpackStateId)
		});
	}

	// Install the menu entry: create StoryMenu when missing, otherwise append
	// the link to the existing passage (visual passages get a new text block so
	// the visual and generated text never desync).
	const storyMenu = passages.find(passage => passage.name === 'StoryMenu');

	if (!storyMenu) {
		passages.push({
			...passageDefaults(),
			...freePlacement(passages),
			id: uuid(),
			name: 'StoryMenu',
			story: story.id,
			visual: {
				blocks: [{id: uuid(), kind: 'text', text: BACKPACK_MENU_LINK}],
				version: 2
			}
		});
	} else if (!storyMenu.text.includes(BACKPACK_MENU_LINK)) {
		if (storyMenu.visual) {
			storyMenu.visual = {
				blocks: [
					...migrateVisualContent(storyMenu.visual).blocks,
					{id: uuid(), kind: 'text', text: BACKPACK_MENU_LINK}
				],
				version: 2
			};
		} else {
			storyMenu.text = `${storyMenu.text}\n${BACKPACK_MENU_LINK}`;
		}
	}

	const nextStory: Story = {
		...story,
		passages,
		visual: {states, version: 1}
	};

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
		visual: nextStory.visual
	});
}