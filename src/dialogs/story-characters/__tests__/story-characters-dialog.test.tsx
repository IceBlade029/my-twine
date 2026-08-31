import {fireEvent, render, screen, within} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../store/stories';
import {fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {StoryCharactersDialog} from '../story-characters-dialog';

describe('<StoryCharactersDialog>', () => {
	const VisualInspector = () => {
		const {stories} = useStoriesContext();

		return <pre data-testid="visual-inspector">{JSON.stringify({passages: stories[0].passages.map(passage => passage.visual), visual: stories[0].visual})}</pre>;
	};

	function renderComponent() {
		const story = fakeStory(1);

		story.visual = {
			characters: [
				{color: 'blue', id: 'lin', name: '林默'},
				{color: 'coral', id: 'su', name: '苏青'}
			],
			states: [],
			version: 1
		};
		story.passages[0].name = '初遇';
		story.passages[0].visual = {
			blocks: [{characterId: 'lin', id: 'd1', kind: 'dialogue', participantCharacterIds: ['lin', 'su'], text: '你好'}],
			version: 2
		};

		const result = render(
			<FakeStateProvider stories={[story]}>
				<StoryCharactersDialog
					collapsed={false}
					onChangeCollapsed={jest.fn()}
					onChangeHighlighted={jest.fn()}
					onChangeMaximized={jest.fn()}
					onChangeProps={jest.fn()}
					onClose={jest.fn()}
					storyId={story.id}
				/>
				<StoryInspector />
				<VisualInspector />
			</FakeStateProvider>
		);

		return {...result, story};
	}

	it('shows rename impact and recompiles every referenced line', () => {
		const {container, story} = renderComponent();
		const row = screen.getByText('林默').closest('.character-row') as HTMLElement;

		fireEvent.click(within(row).getByLabelText('common.edit'));
		fireEvent.change(within(row).getByLabelText('dialogs.storyCharacters.name'), {target: {value: '林科'}});

		expect(within(row).getByText('dialogs.storyCharacters.renameImpact')).toBeInTheDocument();
		expect(within(row).getByText('初遇')).toBeInTheDocument();
		fireEvent.click(within(row).getByText('common.ok'));

		expect(screen.getByText('林科')).toBeInTheDocument();
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('林科');
		expect(container.querySelectorAll('.character-row')).toHaveLength(2);
	});

	it('requires replacement and atomically replaces speaker references before deletion', () => {
		const {container, story} = renderComponent();
		const row = screen.getByText('林默').closest('.character-row') as HTMLElement;

		fireEvent.click(within(row).getByLabelText('common.delete'));
		const confirm = within(row).getByText('dialogs.storyCharacters.replaceAndDelete');

		expect(confirm).toBeDisabled();
		fireEvent.change(within(row).getByLabelText('dialogs.storyCharacters.replacement'), {target: {value: 'su'}});
		fireEvent.click(confirm);

		expect(container.querySelectorAll('.character-row')).toHaveLength(1);
		expect(screen.queryByText('林默')).not.toBeInTheDocument();
		const compiled = screen.getByTestId(`passage-${story.passages[0].id}`);
		expect(compiled).toHaveTextContent('data-character-id="su"');
		expect(compiled).toHaveTextContent('苏青');
	});

	it('removes participant-only references without asking for a replacement', () => {
		const {container} = renderComponent();
		const row = screen.getByText('苏青').closest('.character-row') as HTMLElement;

		fireEvent.click(within(row).getByLabelText('common.delete'));
		expect(within(row).queryByLabelText('dialogs.storyCharacters.replacement')).not.toBeInTheDocument();
		fireEvent.click(within(row).getByText('common.delete'));

		expect(container.querySelectorAll('.character-row')).toHaveLength(1);
		expect(screen.getByTestId('visual-inspector')).not.toHaveTextContent('"su"');
	});
});
