import {Passage, VisualBlock} from '../store/stories';
import {migrateVisualContent} from './visual-passage';

function blocksHaveContent(blocks: VisualBlock[]): boolean {
	return blocks.some(block => {
		if (block.kind === 'text') {
			return block.text !== '';
		}

		if (block.kind === 'choice') {
			return block.label !== '';
		}

		if (block.kind === 'variable') {
			return block.stateId !== '';
		}

		if (block.kind === 'include') {
			return block.targetPassageId !== '';
		}

		return block.branches.some(branch => blocksHaveContent(branch.blocks));
	});
}

/**
 * Returns whether a passage is considered empty, e.g. whether the user has put
 * any content into it.
 */
export function passageIsEmpty(passage: Passage) {
	const hasContent = passage.visual
		? blocksHaveContent(migrateVisualContent(passage.visual).blocks)
		: passage.text !== '';

	return (
		!hasContent &&
		passage.tags.length === 0 &&
		passage.width === 100 &&
		passage.height === 100
	);
}
