import {v4 as uuid} from '@lukeed/uuid';
import {passageDefaults} from '../defaults';
import {CreatePassageAction, Story} from '../stories.types';
import {rectsIntersect} from '../../../util/geometry';
import {emptyVisualPassage} from '../../../util/visual-passage';

/**
 * Creates a new SugarCube special passage with the exact given name (for
 * example, "StoryInit" or "StoryCaption"). The passage is placed below the
 * lowest existing passage, nudged rightward until it overlaps none of them. If
 * a passage with that exact name already exists, the caller should handle the
 * conflict before dispatching this action; this creator always produces a new
 * passage with a fresh id.
 */
export function createSpecialPassage(
	story: Story,
	name: string
): CreatePassageAction {
	const defs = passageDefaults();
	const id = uuid();
	const gap = 25;

	// Start below the lowest existing passage, or at the origin if empty.
	const lowestTop = story.passages.reduce(
		(max, passage) => Math.max(max, passage.top + passage.height),
		defs.height + gap
	);
	const bounds = {
		height: defs.height,
		left: defs.left,
		top: Math.max(lowestTop + gap, 0),
		width: defs.width
	};

	const needsMoving = () =>
		story.passages.some(
			passage => passage.id !== id && rectsIntersect(passage, bounds)
		);

	while (needsMoving()) {
		bounds.left += bounds.width + gap;
	}

	return {
		type: 'createPassage',
		storyId: story.id,
		props: {
			...bounds,
			story: story.id,
			name,
			id,
			visual: emptyVisualPassage()
		}
	};
}
