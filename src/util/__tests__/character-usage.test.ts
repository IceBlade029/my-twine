import {fakeStory} from '../../test-util';
import {characterUsage, replaceCharacterReferences} from '../character-usage';

describe('character usage', () => {
	it('counts speaker lines and adjacent participant groups recursively', () => {
		const story = fakeStory(1);

		story.passages[0].name = '走廊';
		story.passages[0].visual = {
			blocks: [
				{characterId: 'lin', id: 'd1', kind: 'dialogue', participantCharacterIds: ['lin', 'su'], text: '一'},
				{characterId: 'su', id: 'd2', kind: 'dialogue', participantCharacterIds: ['lin', 'su'], text: '二'},
				{id: 'text', kind: 'text', text: '间隔'},
				{
					branches: [
						{blocks: [{characterId: 'lin', id: 'd3', kind: 'dialogue', participantCharacterIds: ['lin'], text: '三'}], id: 'yes', condition: {kind: 'literal', value: true}},
						{blocks: [], id: 'no'}
					],
					id: 'branch',
					kind: 'branch'
				}
			],
			version: 2
		};

		expect(characterUsage(story, 'lin')).toEqual({
			participantGroups: 2,
			passages: [{participantGroups: 2, passageId: story.passages[0].id, passageName: '走廊', speakerLines: 2}],
			speakerLines: 2
		});
	});

	it('replaces speaker and participant references without duplicates', () => {
		const content = {
			blocks: [{characterId: 'lin', id: 'd1', kind: 'dialogue' as const, participantCharacterIds: ['lin', 'su'], text: '你好'}],
			version: 2 as const
		};
		const replaced = replaceCharacterReferences(content, 'lin', 'su');
		const dialogue = replaced.blocks[0];

		expect(dialogue).toMatchObject({characterId: 'su', participantCharacterIds: ['su']});
	});

	it('removes participant-only references without changing speaker lines', () => {
		const content = {
			blocks: [{characterId: 'su', id: 'd1', kind: 'dialogue' as const, participantCharacterIds: ['lin', 'su'], text: '你好'}],
			version: 2 as const
		};
		const changed = replaceCharacterReferences(content, 'lin');

		expect(changed.blocks[0]).toMatchObject({characterId: 'su', participantCharacterIds: ['su']});
	});
});
