import {PassageEditStack} from '../../passage-edit';
import {addPassageEditors, removePassageEditors} from '../action-creators';

describe('addPassageEditors', () => {
	it("dispatches an action to create a passage editor stack if one doesn't exist", () => {
		const dispatch = jest.fn();

		addPassageEditors('test-story-id', ['test-passage-id'])(dispatch, () => []);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					component: PassageEditStack,
					props: {passageIds: ['test-passage-id'], storyId: 'test-story-id'},
					type: 'addDialog'
				}
			]
		]);
	});

	it('dispatches an action to replace the passage in an existing editor', () => {
		const dispatch = jest.fn();

		addPassageEditors('test-story-id', ['test-passage-id'])(dispatch, () => [
			{
				collapsed: false,
				component: PassageEditStack,
				highlighted: false,
				maximized: false,
				props: {passageIds: ['existing-passage-id'], storyId: 'test-story-id'}
			}
		]);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					index: 0,
					props: {
						passageIds: ['test-passage-id'],
						storyId: 'test-story-id'
					},
					type: 'setDialogProps'
				}
			]
		]);
	});

	it('keeps only the requested passage when it is already in the editor', () => {
		const dispatch = jest.fn();

		addPassageEditors('test-story-id', ['test-passage-id'])(dispatch, () => [
			{
				collapsed: false,
				component: PassageEditStack,
				highlighted: false,
				maximized: false,
				props: {
					passageIds: ['existing-passage-id', 'test-passage-id'],
					storyId: 'test-story-id'
				}
			}
		]);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					index: 0,
					props: {
						passageIds: ['test-passage-id'],
						storyId: 'test-story-id'
					},
					type: 'setDialogProps'
				}
			]
		]);
	});

	it('uses only the first requested passage', () => {
		const dispatch = jest.fn();

		addPassageEditors('test-story-id', [
			'test-passage-id',
			'another-passage-id'
		])(dispatch, () => [
			{
				collapsed: false,
				component: PassageEditStack,
				highlighted: false,
				maximized: false,
				props: {
					passageIds: [
						'existing-passage-id-1',
						'existing-passage-id-2',
						'existing-passage-id-3'
					],
					storyId: 'test-story-id'
				}
			}
		]);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					index: 0,
					props: {
						passageIds: ['test-passage-id'],
						storyId: 'test-story-id'
					},
					type: 'setDialogProps'
				}
			]
		]);
	});
});

describe('removePassageEditors', () => {
	it('dispatches an action to remove passages from a stack', () => {
		const dispatch = jest.fn();

		removePassageEditors(['test-passage-id'])(dispatch, () => [
			{
				collapsed: false,
				component: PassageEditStack,
				highlighted: false,
				maximized: false,
				props: {
					passageIds: [
						'existing-passage-id-1',
						'test-passage-id',
						'existing-passage-id-2'
					],
					storyId: 'test-story-id'
				}
			}
		]);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					index: 0,
					props: {
						passageIds: ['existing-passage-id-1', 'existing-passage-id-2'],
						storyId: 'test-story-id'
					},
					type: 'setDialogProps'
				}
			]
		]);
	});

	it('dispatches an action to close a stack if all passages have been removed from it', () => {
		const dispatch = jest.fn();

		removePassageEditors(['test-passage-id'])(dispatch, () => [
			{
				collapsed: false,
				component: PassageEditStack,
				highlighted: false,
				maximized: false,
				props: {
					passageIds: ['test-passage-id'],
					storyId: 'test-story-id'
				}
			}
		]);
		expect(dispatch.mock.calls).toEqual([
			[
				{
					index: 0,
					type: 'removeDialog'
				}
			]
		]);
	});

	it('does nothing if no passage stack is in state', () => {
		const dispatch = jest.fn();
		const warnSpy = jest.spyOn(console, 'warn').mockReturnValue();

		removePassageEditors(['test-passage-id'])(dispatch, () => []);
		expect(dispatch).not.toBeCalled();
		warnSpy.mockReset();
	});
});
