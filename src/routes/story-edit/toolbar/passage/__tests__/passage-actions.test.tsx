import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {useStoriesContext} from '../../../../../store/stories';
import {
	FakeStateProvider,
	FakeStateProviderProps,
	fakeStory,
	StoryInspector
} from '../../../../../test-util';
import {PassageActions, PassageActionsProps} from '../passage-actions';

jest.mock('../../../../../components/passage/rename-passage-button');
jest.mock('../../../../../components/control/menu-button');

const TestPassageActions: React.FC<Partial<PassageActionsProps>> = props => {
	const {stories} = useStoriesContext();

	return (
		<PassageActions
			getCenter={() => ({left: 0, top: 0})}
			onOpenFuzzyFinder={jest.fn()}
			story={stories[0]}
			{...props}
		/>
	);
};

describe('<PassageActions>', () => {
	async function renderComponent(
		props?: Partial<PassageActionsProps>,
		contexts?: FakeStateProviderProps
	) {
		const result = render(
			<FakeStateProvider {...contexts}>
				<TestPassageActions {...props} />
				<StoryInspector />
			</FakeStateProvider>
		);

		await act(() => Promise.resolve());
		return result;
	}

	it('displays a create passage button', async () => {
		await renderComponent();
		expect(screen.getByText('common.new')).toBeInTheDocument();
	});

	it('displays a special passage button that creates a special passage', async () => {
		const story = fakeStory(0);
		await renderComponent({story}, {stories: [story]});

		// The mock menu button renders each item as a button; the first one
		// corresponds to StoryTitle (registry insertion order).
		expect(
			screen.getByTestId(
				`mock-menu-button-${'routes.storyEdit.toolbar.newSpecialPassage'}`
			)
		).toBeInTheDocument();

		// Click the first menu item (StoryTitle).
		const menuItems = within(
			screen.getByTestId(
				`mock-menu-button-${'routes.storyEdit.toolbar.newSpecialPassage'}`
			)
		).getAllByRole('button');
		fireEvent.click(menuItems[0]);

		expect(
			document.querySelector('[data-testid^="passage-"][data-name="StoryTitle"]')
		).toBeInTheDocument();
	});

	it('highlights an existing special passage instead of creating a duplicate', async () => {
		const story = fakeStory(1);
		story.passages[0].name = 'StoryTitle';
		story.passages[0].highlighted = false;
		await renderComponent({story}, {stories: [story]});

		const menuItems = within(
			screen.getByTestId(
				`mock-menu-button-${'routes.storyEdit.toolbar.newSpecialPassage'}`
			)
		).getAllByRole('button');
		fireEvent.click(menuItems[0]);

		// Only one passage should exist, and it should now be highlighted.
		const passages = document.querySelectorAll('[data-testid^="passage-"]');
		expect(passages.length).toBe(1);
		expect(
			document.querySelector('[data-testid^="passage-"][data-name="StoryTitle"]')
		).toHaveAttribute('data-highlighted', 'true');
	});

	it('displays a passage edit button', async () => {
		await renderComponent();
		expect(screen.getByText('common.edit')).toBeInTheDocument();
	});

	it('displays a passage rename button that renames a passage', async () => {
		const story = fakeStory(1);

		story.passages[0].selected = true;
		await renderComponent({story}, {stories: [story]});
		fireEvent.click(
			screen.getByText(`mock-rename-passage-button-${story.passages[0].id}`)
		);
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`).dataset.name
		).toBe('mock-new-passage-name');
	});

	it('displays a passage delete button', async () => {
		await renderComponent();
		expect(screen.getByText('common.delete')).toBeInTheDocument();
	});

	it('displays a test passage button', async () => {
		await renderComponent();
		expect(
			screen.getByText('routes.storyEdit.toolbar.testFromHere')
		).toBeInTheDocument();
	});

	it('displays a start at passage button', async () => {
		await renderComponent();
		expect(
			screen.getByText('routes.storyEdit.toolbar.startStoryHere')
		).toBeInTheDocument();
	});

	it('displays a go to passage button', async () => {
		await renderComponent();
		expect(
			screen.getByText('routes.storyEdit.toolbar.goTo')
		).toBeInTheDocument();
	});

	it('displays a select all passages button', async () => {
		await renderComponent();
		expect(screen.getByText('common.selectAll')).toBeInTheDocument();
	});

	it('is accessible', async () => {
		const {container} = await renderComponent();

		expect(await axe(container)).toHaveNoViolations();
	});
});
