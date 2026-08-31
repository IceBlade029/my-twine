import {
	Story,
	VisualBlock,
	VisualPassageContentV2
} from '../store/stories/stories.types';

export interface CharacterPassageUsage {
	participantGroups: number;
	passageId: string;
	passageName: string;
	speakerLines: number;
}

export interface CharacterUsage {
	participantGroups: number;
	passages: CharacterPassageUsage[];
	speakerLines: number;
}

function nestedBlockLists(block: VisualBlock): VisualBlock[][] {
	switch (block.kind) {
		case 'branch':
			return block.branches.map(branch => branch.blocks);
		case 'switch':
			return [
				...block.cases.map(switchCase => switchCase.blocks),
				block.defaultBlocks
			];
		case 'loop':
			return [block.blocks];
		default:
			return [];
	}
}

function usageInBlocks(blocks: VisualBlock[], characterId: string) {
	let speakerLines = 0;
	let participantGroups = 0;

	for (let index = 0; index < blocks.length; index++) {
		const block = blocks[index];

		if (block.kind === 'dialogue') {
			let groupUsesCharacter = false;

			while (index < blocks.length && blocks[index].kind === 'dialogue') {
				const dialogue = blocks[index];

				if (dialogue.kind !== 'dialogue') {
					break;
				}
				if (dialogue.characterId === characterId) {
					speakerLines++;
				}
				if (dialogue.participantCharacterIds?.includes(characterId)) {
					groupUsesCharacter = true;
				}
				index++;
			}

			if (groupUsesCharacter) {
				participantGroups++;
			}
			index--;
			continue;
		}

		for (const nested of nestedBlockLists(block)) {
			const nestedUsage = usageInBlocks(nested, characterId);

			speakerLines += nestedUsage.speakerLines;
			participantGroups += nestedUsage.participantGroups;
		}
	}

	return {participantGroups, speakerLines};
}

/** Returns exact structured references to a story character, grouped by passage. */
export function characterUsage(story: Story, characterId: string): CharacterUsage {
	const passages = story.passages.flatMap(passage => {
		if (passage.visual?.version !== 2) {
			return [];
		}

		const usage = usageInBlocks(passage.visual.blocks, characterId);

		return usage.speakerLines === 0 && usage.participantGroups === 0
			? []
			: [{...usage, passageId: passage.id, passageName: passage.name}];
	});

	return {
		passages,
		participantGroups: passages.reduce(
			(total, passage) => total + passage.participantGroups,
			0
		),
		speakerLines: passages.reduce(
			(total, passage) => total + passage.speakerLines,
			0
		)
	};
}

function changeParticipantIds(
	ids: string[] | undefined,
	characterId: string,
	replacementId?: string
) {
	if (!ids) {
		return undefined;
	}

	return Array.from(
		new Set(
			ids.flatMap(id =>
				id === characterId ? (replacementId ? [replacementId] : []) : [id]
			)
		)
	);
}

/**
 * Rewrites one character throughout a v2 passage. With no replacement, only
 * participant-list references are removed; speaker lines deliberately remain
 * intact so callers cannot accidentally create invisible dialogue.
 */
export function replaceCharacterReferences(
	content: VisualPassageContentV2,
	characterId: string,
	replacementId?: string
): VisualPassageContentV2 {
	const changeBlocks = (blocks: VisualBlock[]): VisualBlock[] =>
		blocks.map(block => {
			switch (block.kind) {
				case 'dialogue':
					return {
						...block,
						characterId:
							block.characterId === characterId && replacementId
								? replacementId
								: block.characterId,
						participantCharacterIds: changeParticipantIds(
							block.participantCharacterIds,
							characterId,
							replacementId
						)
					};
				case 'branch':
					return {
						...block,
						branches: block.branches.map(branch => ({
							...branch,
							blocks: changeBlocks(branch.blocks)
						}))
					};
				case 'switch':
					return {
						...block,
						cases: block.cases.map(switchCase => ({
							...switchCase,
							blocks: changeBlocks(switchCase.blocks)
						})),
						defaultBlocks: changeBlocks(block.defaultBlocks)
					};
				case 'loop':
					return {...block, blocks: changeBlocks(block.blocks)};
				default:
					return block;
			}
		});

	return {...content, blocks: changeBlocks(content.blocks)};
}
