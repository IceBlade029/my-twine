/**
 * The SugarCube 2.x special passages, keyed by their exact, case-sensitive
 * passage name. Each entry maps to a locale key for a short role label and a
 * one-line description (both translated at render time).
 */
export const SPECIAL_PASSAGES: Record<
	string,
	{labelKey: string; descriptionKey: string}
> = {
	StoryTitle: {
		labelKey: 'specialPassages.StoryTitle.label',
		descriptionKey: 'specialPassages.StoryTitle.description'
	},
	StoryAuthor: {
		labelKey: 'specialPassages.StoryAuthor.label',
		descriptionKey: 'specialPassages.StoryAuthor.description'
	},
	StorySubtitle: {
		labelKey: 'specialPassages.StorySubtitle.label',
		descriptionKey: 'specialPassages.StorySubtitle.description'
	},
	StoryInit: {
		labelKey: 'specialPassages.StoryInit.label',
		descriptionKey: 'specialPassages.StoryInit.description'
	},
	StoryCaption: {
		labelKey: 'specialPassages.StoryCaption.label',
		descriptionKey: 'specialPassages.StoryCaption.description'
	},
	StoryMenu: {
		labelKey: 'specialPassages.StoryMenu.label',
		descriptionKey: 'specialPassages.StoryMenu.description'
	},
	PassageHeader: {
		labelKey: 'specialPassages.PassageHeader.label',
		descriptionKey: 'specialPassages.PassageHeader.description'
	},
	PassageFooter: {
		labelKey: 'specialPassages.PassageFooter.label',
		descriptionKey: 'specialPassages.PassageFooter.description'
	},
	PassageDone: {
		labelKey: 'specialPassages.PassageDone.label',
		descriptionKey: 'specialPassages.PassageDone.description'
	}
};

export interface SpecialPassageMeta {
	labelKey: string;
	descriptionKey: string;
	name: string;
}

/**
 * Returns metadata for a passage name if it is one of the special SugarCube
 * passages, otherwise undefined. Lookup is exact and case-sensitive.
 */
export function specialPassageMeta(
	name: string
): SpecialPassageMeta | undefined {
	const entry = SPECIAL_PASSAGES[name];

	if (!entry) {
		return undefined;
	}

	return {descriptionKey: entry.descriptionKey, labelKey: entry.labelKey, name};
}
