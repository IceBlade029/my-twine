import {
	SPECIAL_PASSAGES,
	specialPassageMeta
} from '../special-passages';

describe('specialPassageMeta', () => {
	it('returns metadata for every known special passage name', () => {
		for (const name of [
			'StoryTitle',
			'StoryAuthor',
			'StorySubtitle',
			'StoryInit',
			'StoryCaption',
			'StoryMenu',
			'PassageHeader',
			'PassageFooter',
			'PassageDone'
		]) {
			const meta = specialPassageMeta(name);

			expect(meta).toBeDefined();
			expect(meta!.name).toBe(name);
			expect(meta!.labelKey).toMatch(/^specialPassages\./);
			expect(meta!.descriptionKey).toMatch(/^specialPassages\./);
		}
	});

	it('returns undefined for an unknown name', () => {
		expect(specialPassageMeta('NotSpecial')).toBeUndefined();
		expect(specialPassageMeta('')).toBeUndefined();
	});

	it('is case-sensitive', () => {
		for (const name of ['storyinit', 'STORYINIT', 'StoryInit2', 'Passageheader']) {
			expect(specialPassageMeta(name)).toBeUndefined();
		}
	});

	it('exposes the same set of names in the registry', () => {
		expect(Object.keys(SPECIAL_PASSAGES).sort()).toEqual(
			[
				'PassageDone',
				'PassageFooter',
				'PassageHeader',
				'StoryAuthor',
				'StoryCaption',
				'StoryInit',
				'StoryMenu',
				'StorySubtitle',
				'StoryTitle'
			].sort()
		);
	});
});
