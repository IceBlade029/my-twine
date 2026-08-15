import {Passage} from '../store/stories';

/**
 * Returns whether a passage is considered empty, e.g. whether the user has put
 * any content into it.
 */
export function passageIsEmpty(passage: Passage) {
	const hasContent = passage.visual
		? passage.visual.body !== '' || passage.visual.choices.length > 0
		: passage.text !== '';

	return (
		!hasContent &&
		passage.tags.length === 0 &&
		passage.width === 100 &&
		passage.height === 100
	);
}
