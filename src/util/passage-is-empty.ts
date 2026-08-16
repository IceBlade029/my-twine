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
			// A loop item block always prints something; a state block needs a
			// chosen state.
			return block.source === 'loopItem' || block.stateId !== '';
		}

		if (block.kind === 'set') {
			// A set block counts as content once it names a target state.
			return block.variableId !== '';
		}

		if (block.kind === 'raw') {
			return block.sugar.trim() !== '';
		}

		if (block.kind === 'include') {
			return block.targetPassageId !== '';
		}

		if (block.kind === 'interaction') {
			return block.label !== '' || block.content !== '';
		}

		// A switch or loop block counts as content once it names a state, like
		// a variable block; its nested blocks are not considered on their own.
		if (block.kind === 'switch' || block.kind === 'loop') {
			return block.stateId !== '';
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
