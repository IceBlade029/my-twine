import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {Story, useStoriesContext} from '../../../store/stories';
import {fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {compileVisualPassage} from '../../../util/visual-passage';
import {StoryStatesManager} from '../story-states-manager';

const TestManager = () => {
	const {stories} = useStoriesContext();

	return (
		<>
			<StoryStatesManager story={stories[0]} />
			<StoryInspector />
		</>
	);
};

describe('<StoryStatesManager>', () => {
	function renderComponent(setup?: (story: Story) => void) {
		const story = fakeStory(2);

		story.passages[0].visual = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};
		story.passages[1].name = 'Hallway';
		setup?.(story);
		render(
			<FakeStateProvider stories={[story]}>
				<TestManager />
			</FakeStateProvider>
		);
		return story;
	}

	it('adds a typed story state and recompiles the start passage source', () => {
		const story = renderComponent();

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addState'));
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateName'),
			{target: {value: 'Trust'}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateType'),
			{target: {value: 'number'}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.defaultValue'),
			{target: {value: '2'}}
		);

		// The start passage is recompiled with a state initialization macro.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent(/<<if ndef \$nrp_/);
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('= 2');
	});

	it('strips conditions referencing a deleted state when recompiling', () => {
		const story = renderComponent(story => {
			story.visual = {
				states: [
					{
						defaultValue: 0,
						id: 'state-1',
						name: 'Trust',
						type: 'number'
					}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						condition: {
							operator: 'equals',
							stateId: 'state-1',
							value: 0
						},
						id: 'text-1',
						kind: 'text',
						text: 'Hello.'
					}
				],
				version: 2
			};
			story.passages[0].text = compileVisualPassage(
				story.passages[0].visual,
				story,
				story.passages[0].id
			);
		});

		// The condition compiles while the state exists.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent(/<<if \$nrp_/);

		// Delete the only state; the condition must be stripped on recompile.
		fireEvent.click(screen.getByText('×'));

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent(/<<if/);
	});
});
