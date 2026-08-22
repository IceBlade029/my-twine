import {fireEvent, render, screen, within} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {
	StoryStructureDialog,
	StoryStructureDialogProps
} from '../story-structure-dialog';

describe('<StoryStructureDialog>', () => {
	function renderComponent(
		setup?: (story: ReturnType<typeof fakeStory>) => void,
		props?: Partial<StoryStructureDialogProps>
	) {
		const story = fakeStory(1);

		setup?.(story);

		const result = render(
			<FakeStateProvider stories={[story]}>
				<StoryStructureDialog
					collapsed={false}
					onChangeCollapsed={jest.fn()}
					onChangeHighlighted={jest.fn()}
					onChangeMaximized={jest.fn()}
					onChangeProps={jest.fn()}
					onClose={jest.fn()}
					storyId={story.id}
					{...props}
				/>
				<StoryInspector />
			</FakeStateProvider>
		);

		return {...result, story};
	}

	it('groups story systems and optional SugarCube global passages', () => {
		const {container} = renderComponent();

		expect(screen.getByText('dialogs.storyStructure.systemsAndCapabilities')).toBeInTheDocument();
		expect(screen.getByText('dialogs.storyStructure.storyInformation')).toBeInTheDocument();
		expect(screen.getByText('dialogs.storyStructure.globalInterface')).toBeInTheDocument();
		expect(screen.getByText('dialogs.storyStructure.runtimeAdvanced')).toBeInTheDocument();
		expect(screen.getByText('StoryDisplayTitle')).toBeInTheDocument();
		expect(screen.getByText('PassageReady')).toBeInTheDocument();
		expect(screen.getByText('StoryInterface')).toBeInTheDocument();
		expect(screen.queryByText('StoryTitle')).not.toBeInTheDocument();
		expect(container.querySelectorAll('.story-global-card')).toHaveLength(12);
	});

	it('creates an optional special Passage only when requested', () => {
		const {container} = renderComponent();
		const headerCard = screen
			.getByText('PassageHeader')
			.closest('.story-global-card') as HTMLElement;

		expect(
			container.querySelector('[data-name="PassageHeader"]')
		).not.toBeInTheDocument();
		fireEvent.click(
			within(headerCard).getByText('dialogs.storyStructure.createAndEdit')
		);
		expect(
			container.querySelector('[data-name="PassageHeader"]')
		).toBeInTheDocument();
		expect(
			within(headerCard).getByText('dialogs.storyStructure.created')
		).toBeInTheDocument();
	});

	it('enables and repairs systems from the story-level center', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 1, id: 'day', name: 'day', type: 'number'},
					{defaultValue: 0, id: 'period', name: 'period', type: 'number'}
				],
				version: 1
			};
		});
		const timeCard = container.querySelector(
			'.story-system-card.system-time'
		) as HTMLElement;

		expect(timeCard).toHaveClass('is-incomplete');
		fireEvent.click(within(timeCard).getByText('dialogs.storyStructure.repair'));
		expect(timeCard).toHaveClass('is-ready');
		expect(container.querySelector('[data-name="StoryInit"]')).toBeInTheDocument();
		expect(container.querySelector('[data-name="StoryCaption"]')).toBeInTheDocument();
	});

	it('is accessible', async () => {
		const {container} = renderComponent();

		expect(await axe(container)).toHaveNoViolations();
	});
});
