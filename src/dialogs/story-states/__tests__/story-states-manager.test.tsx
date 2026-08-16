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

	it('strips an interaction block condition referencing a deleted state', () => {
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
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 2
						},
						content: 'Secret.',
						id: 'int-1',
						kind: 'interaction',
						label: 'Reveal',
						operation: 'reveal'
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
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);

		// The condition compiles while the state exists.
		expect(passageText()).toHaveTextContent(/<<if \$nrp_/);

		// Deleting the state strips the interaction block's condition but keeps
		// the block itself, like a text block.
		fireEvent.click(screen.getByText('×'));

		expect(passageText()).not.toHaveTextContent(/<<if/);
		expect(passageText()).toHaveTextContent('<<link "Reveal">>');
	});

	it('strips a raw block condition referencing a deleted state', () => {
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
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 2
						},
						id: 'raw-1',
						kind: 'raw',
						sugar: '<<set $custom = 1>>'
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
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);

		// The condition compiles while the state exists.
		expect(passageText()).toHaveTextContent(/<<if \$nrp_/);

		// Deleting the state strips the raw block's condition but keeps the
		// block and its sugar, like a text block.
		fireEvent.click(screen.getByText('×'));

		expect(passageText()).not.toHaveTextContent(/<<if/);
		expect(passageText()).toHaveTextContent('<<set $custom = 1>>');
	});

	it('leaves loop item variable blocks untouched when a state is deleted', () => {
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
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 1
						},
						id: 'var-loop',
						kind: 'variable',
						source: 'loopItem',
						stateId: undefined
					},
					{
						id: 'var-state',
						kind: 'variable',
						source: 'state',
						stateId: 'state-1'
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
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);

		// Both blocks compile while the state exists.
		expect(passageText()).toHaveTextContent('<<print _item>>');
		expect(passageText()).toHaveTextContent('<<print $nrp_state_1>>');

		// Deleting the state strips both conditions but keeps the loop item
		// block (no state id to clear); the state block becomes incomplete.
		fireEvent.click(screen.getByText('×'));

		expect(passageText()).toHaveTextContent('<<print _item>>');
		expect(passageText()).not.toHaveTextContent('<<print $nrp_state_1>>');
		expect(passageText()).not.toHaveTextContent(/<<if/);
	});

	it('clears switch and loop state ids and strips nested conditions when states are deleted', () => {
		const story = renderComponent(story => {
			story.visual = {
				states: [
					{
						defaultValue: 0,
						id: 'state-1',
						name: 'Trust',
						type: 'number'
					},
					{
						defaultValue: ['a'],
						id: 'state-2',
						name: 'Inventory',
						type: 'list'
					}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						cases: [
							{
								blocks: [
									{
										condition: {
											operator: 'equals',
											stateId: 'state-1',
											value: 1
										},
										id: 'text-1',
										kind: 'text',
										text: 'Happy.'
									}
								],
								id: 'case-1',
								value: 1
							}
						],
						defaultBlocks: [],
						id: 'switch-1',
						kind: 'switch',
						stateId: 'state-1'
					},
					{
						blocks: [
							{
								condition: {
									operator: 'includes',
									stateId: 'state-1',
									value: 1
								},
								id: 'text-2',
								kind: 'text',
								text: 'Item.'
							}
						],
						id: 'loop-1',
						kind: 'loop',
						stateId: 'state-2'
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
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);
		// Only the per-state delete buttons (the list state's item remove
		// buttons also render as '×', nested inside the row).
		const stateDeleteButtons = () =>
			screen
				.getAllByText('×')
				.filter(
					button =>
						button.parentElement?.classList.contains('state-row') ?? false
				);

		// Both blocks compile while their states exist.
		expect(passageText()).toHaveTextContent('<<switch $nrp_state_1>>');
		expect(passageText()).toHaveTextContent(
			'<<for _item range $nrp_state_2>>'
		);

		// Deleting the switch's state clears its state id (the switch stops
		// compiling) and strips the loop body's condition on the deleted state.
		fireEvent.click(stateDeleteButtons()[0]);

		expect(passageText()).not.toHaveTextContent('<<switch');
		expect(passageText()).not.toHaveTextContent('<<if $nrp_state_1');
		expect(passageText()).toHaveTextContent(
			'<<for _item range $nrp_state_2>>Item.<</for>>'
		);

		// Deleting the loop's state clears its state id too: nothing compiles.
		fireEvent.click(stateDeleteButtons()[0]);

		expect(passageText()).not.toHaveTextContent('<<for');
		expect(passageText()).not.toHaveTextContent(/<<if/);
	});

	it('defaults a new list state to an empty list', () => {
		const story = renderComponent();

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addState'));
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateType'),
			{target: {value: 'list'}}
		);

		// The start passage recompiles with an empty-list initialization.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('= []');
	});

	it('edits the items of a list state default value', () => {
		const story = renderComponent(story => {
			story.visual = {
				states: [
					{
						defaultValue: ['key'],
						id: 'state-1',
						name: 'Inventory',
						type: 'list'
					}
				],
				version: 1
			};
		});

		// One item input for the existing default item.
		expect(
			screen.getAllByLabelText('dialogs.passageEdit.visual.listItem')
		).toHaveLength(1);

		// Add a second item and type it.
		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addListItem'));
		fireEvent.change(
			screen.getAllByLabelText('dialogs.passageEdit.visual.listItem')[1],
			{target: {value: 'torch'}}
		);

		// The recompiled default now contains both items.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('["key","torch"]');

		// Removing the first item updates the default as well.
		fireEvent.click(
			screen.getAllByLabelText('dialogs.passageEdit.visual.removeListItem')[0]
		);
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('["torch"]');
	});

	it('drops type-incompatible actions and conditions when a state type changes', () => {
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
						actions: [
							{operation: 'increase', stateId: 'state-1', value: 1},
							{operation: 'set', stateId: 'state-1', value: 0}
						],
						id: 'choice-1',
						kind: 'choice',
						label: 'Go',
						targetPassageId: story.passages[1].id
					},
					{
						condition: {
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 2
						},
						id: 'text-1',
						kind: 'text',
						text: 'High.'
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
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);

		// While number, the increase action and greaterThan condition compile.
		expect(passageText()).toHaveTextContent('$nrp_state_1 += 1');
		expect(passageText()).toHaveTextContent('$nrp_state_1 gt 2');

		// Changing the type to list strips both; the set action survives.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateType'),
			{target: {value: 'list'}}
		);

		expect(passageText()).not.toHaveTextContent('$nrp_state_1 += 1');
		expect(passageText()).not.toHaveTextContent('gt 2');
		expect(passageText()).toHaveTextContent('$nrp_state_1 = 0');
	});
});
