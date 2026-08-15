import {
	Story,
	VisualBlock,
	VisualBranch,
	VisualBranchBlock,
	VisualChoiceBlock,
	VisualCondition,
	VisualStoryContentV1,
	VisualTextBlock
} from '../store/stories';
import {
	compileVisualPassage,
	migrateVisualContent
} from './visual-passage';

export const visualEditorMetadataSelector =
	'script[type="application/json"][data-narrative-editor]';

interface SerializedChoiceBlock
	extends Omit<VisualChoiceBlock, 'targetPassageId'> {
	targetPassageName: string;
}

interface SerializedBranchBlock
	extends Omit<VisualBranchBlock, 'branches'> {
	branches: SerializedBranch[];
}

interface SerializedBranch extends Omit<VisualBranch, 'blocks'> {
	blocks: SerializedBlock[];
}

type SerializedBlock =
	| VisualTextBlock
	| SerializedChoiceBlock
	| SerializedBranchBlock;

interface SerializedPassageV1 {
	body: string;
	bodyCondition?: VisualCondition;
	choices: SerializedChoiceBlock[];
	generatedText: string;
	version: 1;
}

interface SerializedPassageV2 {
	blocks: SerializedBlock[];
	generatedText: string;
	version: 2;
}

interface VisualEditorMetadataV1 {
	passages: Record<string, SerializedPassageV1>;
	story: VisualStoryContentV1;
	version: 1;
}

interface VisualEditorMetadataV2 {
	passages: Record<string, SerializedPassageV2>;
	story: VisualStoryContentV1;
	version: 2;
}

function serializeBlockList(
	blocks: VisualBlock[],
	story: Story
): SerializedBlock[] {
	return blocks.map(block => {
		if (block.kind === 'choice') {
			const {targetPassageId, ...saved} = block;

			return {
				...saved,
				targetPassageName:
					story.passages.find(target => target.id === targetPassageId)
						?.name ?? ''
			};
		}

		if (block.kind === 'branch') {
			return {
				...block,
				branches: block.branches.map(branch => ({
					...branch,
					blocks: serializeBlockList(branch.blocks, story)
				}))
			};
		}

		return block;
	});
}

export function serializeVisualEditorMetadata(
	story: Story
): VisualEditorMetadataV2 {
	return {
		passages: story.passages.reduce<Record<string, SerializedPassageV2>>(
			(result, passage) => {
				if (!passage.visual) {
					return result;
				}

				result[passage.name] = {
					blocks: serializeBlockList(
						migrateVisualContent(passage.visual).blocks,
						story
					),
					generatedText: compileVisualPassage(
						passage.visual,
						story,
						passage.id
					),
					version: 2
				};
				return result;
			},
			{}
		),
		story: story.visual ?? {states: [], version: 1},
		version: 2
	};
}

export function parseVisualEditorMetadata(raw: string | null) {
	if (!raw) {
		return undefined;
	}

	try {
		const value = JSON.parse(raw) as
			| VisualEditorMetadataV1
			| VisualEditorMetadataV2;

		if (
			(value.version !== 1 && value.version !== 2) ||
			value.story?.version !== 1 ||
			typeof value.passages !== 'object'
		) {
			return undefined;
		}

		return value;
	} catch {
		return undefined;
	}
}

function restoreBlockList(
	blocks: SerializedBlock[],
	story: Story
): VisualBlock[] {
	return blocks.map(block => {
		if (block.kind === 'choice') {
			const {targetPassageName, ...restored} = block;

			return {
				...restored,
				actions: block.actions ?? [],
				targetPassageId:
					story.passages.find(target => target.name === targetPassageName)
						?.id ?? ''
			};
		}

		if (block.kind === 'branch') {
			return {
				...block,
				branches: block.branches.map(branch => ({
					...branch,
					blocks: restoreBlockList(branch.blocks, story)
				}))
			};
		}

		return block;
	});
}

export function restoreVisualEditorMetadata(
	story: Story,
	metadata: VisualEditorMetadataV1 | VisualEditorMetadataV2
) {
	story.visual = metadata.story;
	story.passages = story.passages.map(passage => {
		const saved = metadata.passages[passage.name];

		// An externally modified generated passage becomes a source passage. This
		// avoids silently overwriting edits that the visual model cannot represent.
		if (!saved || saved.generatedText !== passage.text) {
			return passage;
		}

		if (metadata.version === 2) {
			if (saved.version !== 2) {
				return passage;
			}

			return {
				...passage,
				visual: {
					blocks: restoreBlockList(saved.blocks, story),
					version: 2
				}
			};
		}

		// Legacy v1 metadata: restore the v1 model, then migrate it to v2 so all
		// visual passages end up as v2 content.
		if (saved.version !== 1) {
			return passage;
		}

		return {
			...passage,
			visual: migrateVisualContent({
				body: saved.body,
				bodyCondition: saved.bodyCondition,
				choices: saved.choices.map(choice => {
					const {targetPassageName, ...restoredChoice} = choice;

					return {
						...restoredChoice,
						actions: choice.actions ?? [],
						targetPassageId:
							story.passages.find(
								target => target.name === targetPassageName
							)?.id ?? ''
					};
				}),
				version: 1
			})
		};
	});
}
