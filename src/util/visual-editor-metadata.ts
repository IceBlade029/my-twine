import {
	Story,
	VisualPassageContentV1,
	VisualStoryContentV1
} from '../store/stories';
import {compileVisualPassage} from './visual-passage';

export const visualEditorMetadataSelector =
	'script[type="application/json"][data-narrative-editor]';

interface SerializedChoice
	extends Omit<VisualPassageContentV1['choices'][number], 'targetPassageId'> {
	targetPassageName: string;
}

interface SerializedPassage
	extends Omit<VisualPassageContentV1, 'choices'> {
	choices: SerializedChoice[];
	generatedText: string;
}

export interface VisualEditorMetadataV1 {
	passages: Record<string, SerializedPassage>;
	story: VisualStoryContentV1;
	version: 1;
}

export function serializeVisualEditorMetadata(
	story: Story
): VisualEditorMetadataV1 {
	return {
		passages: story.passages.reduce<Record<string, SerializedPassage>>(
			(result, passage) => {
				if (!passage.visual) {
					return result;
				}

				result[passage.name] = {
					...passage.visual,
					choices: passage.visual.choices.map(choice => {
						const {targetPassageId, ...savedChoice} = choice;

						return {
							...savedChoice,
							targetPassageName:
								story.passages.find(target => target.id === targetPassageId)
									?.name ?? ''
						};
					}),
					generatedText: compileVisualPassage(passage.visual, story)
				};
				return result;
			},
			{}
		),
		story: story.visual ?? {states: [], version: 1},
		version: 1
	};
}

export function parseVisualEditorMetadata(raw: string | null) {
	if (!raw) {
		return undefined;
	}

	try {
		const value = JSON.parse(raw) as VisualEditorMetadataV1;

		if (
			value.version !== 1 ||
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

export function restoreVisualEditorMetadata(
	story: Story,
	metadata: VisualEditorMetadataV1
) {
	story.visual = metadata.story;
	story.passages = story.passages.map(passage => {
		const saved = metadata.passages[passage.name];

		// An externally modified generated passage becomes a source passage. This
		// avoids silently overwriting edits that the visual model cannot represent.
		if (!saved || saved.generatedText !== passage.text || saved.version !== 1) {
			return passage;
		}

		return {
			...passage,
			visual: {
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
			}
		};
	});
}
