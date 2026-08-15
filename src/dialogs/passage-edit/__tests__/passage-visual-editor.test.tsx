import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {useStoriesContext} from '../../../store/stories';
import {fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {PassageVisualEditor} from '../passage-visual-editor';

const TestEditor = () => {
	const {stories} = useStoriesContext();
	const story = stories[0];
	const passage = story.passages[0];

	if (!passage.visual) {
		throw new Error('Passage is not visual');
	}

	return (
		<>
			<PassageVisualEditor passage={{...passage, visual: passage.visual}} story={story} />
			<StoryInspector />
		</>
	);
};

describe('<PassageVisualEditor>', () => {
	function renderComponent() {
		const story = fakeStory(2);

		story.passages[0].visual = {body: '', choices: [], version: 1};
		story.passages[1].name = 'Hallway';
		render(
			<FakeStateProvider stories={[story]}>
				<TestEditor />
			</FakeStateProvider>
		);
		return story;
	}

	it('commits body text as generated passage text on blur', () => {
		const story = renderComponent();
		const body = screen.getByLabelText('dialogs.passageEdit.visual.body');

		fireEvent.change(body, {target: {value: 'A quiet room.'}});
		fireEvent.blur(body);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('A quiet room.');
	});

	it('adds and completes a choice without writing SugarCube syntax', () => {
		const story = renderComponent();

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addChoice'));
		const label = screen.getByLabelText(
			'dialogs.passageEdit.visual.choiceLabel'
		);
		fireEvent.change(label, {target: {value: 'Leave'}});
		fireEvent.blur(label);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.choiceTarget'),
			{target: {value: story.passages[1].id}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('[[Leave->Hallway]]');
	});

	it('adds a typed story state and recompiles generated source', () => {
		renderComponent();
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
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.showSource')
		);

		expect(screen.getByText(/<<if ndef \$nrp_/, {selector: 'pre'})).toHaveTextContent('= 2');
	});
});
