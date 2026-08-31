import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../../../store/stories';
import {FakeStateProvider} from '../../../../../test-util';
import {StoryStructureButton} from '../story-structure-button';

const TestStoryStructureButton = () => {
	const {stories} = useStoriesContext();

	return <StoryStructureButton story={stories[0]} />;
};

describe('<StoryStructureButton>', () => {
	it('opens story systems and global content as a wide modal', () => {
		const {container} = render(
			<FakeStateProvider>
				<TestStoryStructureButton />
			</FakeStateProvider>
		);

		fireEvent.click(screen.getByText('routes.storyEdit.toolbar.storyStructure'));

		expect(screen.getByText('dialogs.storyStructure.title')).toBeInTheDocument();
		expect(container.querySelector('.dialog-modal-layer')).toBeInTheDocument();
		expect(container.querySelector('.dialog-modal-surface')).toHaveClass('is-wide');
		expect(container.querySelector('.dialogs')).not.toHaveClass('passage-editor-open');
	});
});
