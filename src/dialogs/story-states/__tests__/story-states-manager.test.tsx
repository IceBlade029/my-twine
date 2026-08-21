import {fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';
import {Story, useStoriesContext} from '../../../store/stories';
import {fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {VisualBinaryOperator} from '../../../store/stories';
import {compileVisualPassage} from '../../../util/visual-passage';
import {StoryStatesManager, isActionCompatible} from '../story-states-manager';


function cond(operator: VisualBinaryOperator, variableId: string, value: boolean | number | string) {
	return {
		kind: 'binary' as const,
		operator,
		left: {kind: 'variable' as const, variableId},
		right: {kind: 'literal' as const, value}
	};
}

const TestManager = () => {
	const {stories} = useStoriesContext();

	return (
		<>
			<StoryStatesManager story={stories[0]} />
			<StoryInspector />
		</>
	);
};

/** The DOM node of the StoryInit passage, if one exists. */
function storyInitNode() {
	return document.querySelector(
		'[data-testid^="passage-"][data-name="StoryInit"]'
	);
}

/** Number of passages in the story named StoryInit. */
function storyInitCount() {
	return document.querySelectorAll(
		'[data-testid^="passage-"][data-name="StoryInit"]'
	).length;
}

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

	it('adds a typed story state and compiles its initialization into StoryInit', () => {
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

		// A StoryInit passage is auto-created to own the initialization, which
		// SugarCube runs once at story start.
		expect(storyInitCount()).toBe(1);
		expect(storyInitNode()).toHaveTextContent(/<<if ndef \$Trust/);
		expect(storyInitNode()).toHaveTextContent('= 2');

		// The start passage no longer owns the init block.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent(/<<if ndef \$Trust/);
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
						condition: cond('==', 'state-1', 0),
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
		).toHaveTextContent(/<<if \(?\$Trust/);

		// Delete the only state; the condition must be stripped on recompile.
		fireEvent.click(screen.getByText('×'));

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent(/<<if/);
	});

	it('strips count conditions referencing a deleted state', () => {
		const story = renderComponent(story => {
			story.visual = {
				states: [
					{
						defaultValue: [],
						id: 'state-1',
						name: 'backpack',
						type: 'list'
					}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						condition: {
							kind: 'binary',
							operator: '>=',
							left: {
								kind: 'count',
								variableId: 'state-1',
								value: '药草'
							},
							right: {kind: 'literal', value: 2}
						},
						id: 'text-1',
						kind: 'text',
						text: 'Craft.'
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

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('($backpack).count("药草") >= 2');

		// Deleting the state strips the count condition on recompile.
		fireEvent.click(screen.getByText('×'));

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent(/count|<<if/);
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
						condition: cond('>', 'state-1', 2),
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
		expect(passageText()).toHaveTextContent(/<<if \(?\$Trust/);

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
						condition: cond('>', 'state-1', 2),
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
		expect(passageText()).toHaveTextContent(/<<if \(?\$Trust/);

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
						condition: cond('>', 'state-1', 1),
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
		expect(passageText()).toHaveTextContent('<<print $Trust>>');

		// Deleting the state strips both conditions but keeps the loop item
		// block (no state id to clear); the state block becomes incomplete.
		fireEvent.click(screen.getByText('×'));

		expect(passageText()).toHaveTextContent('<<print _item>>');
		expect(passageText()).not.toHaveTextContent('<<print $Trust>>');
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
										condition: cond('==', 'state-1', 1),
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
								condition: cond('includes', 'state-1', 1),
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
		expect(passageText()).toHaveTextContent('<<switch $Trust>>');
		expect(passageText()).toHaveTextContent(
			'<<for _item range $Inventory>>'
		);

		// Deleting the switch's state clears its state id (the switch stops
		// compiling) and strips the loop body's condition on the deleted state.
		fireEvent.click(stateDeleteButtons()[0]);

		expect(passageText()).not.toHaveTextContent('<<switch');
		expect(passageText()).not.toHaveTextContent('<<if $Trust');
		expect(passageText()).toHaveTextContent(
			'<<for _item range $Inventory>>Item.<</for>>'
		);

		// Deleting the loop's state clears its state id too: nothing compiles.
		fireEvent.click(stateDeleteButtons()[0]);

		expect(passageText()).not.toHaveTextContent('<<for');
		expect(passageText()).not.toHaveTextContent(/<<if/);
	});

	it('defaults a new list state to an empty list', () => {
		renderComponent();

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addState'));
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateType'),
			{target: {value: 'list'}}
		);

		// The StoryInit passage recompiles with an empty-list initialization.
		expect(storyInitNode()).toHaveTextContent('= []');
	});

	it('edits the items of a list state default value', () => {
		renderComponent(story => {
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

		// The recompiled StoryInit default now contains both items.
		expect(storyInitNode()).toHaveTextContent('["key","torch"]');

		// Removing the first item updates the default as well.
		fireEvent.click(
			screen.getAllByLabelText('dialogs.passageEdit.visual.removeListItem')[0]
		);
		expect(storyInitNode()).toHaveTextContent('["torch"]');
	});

	it('does not create a second StoryInit and preserves an existing one', () => {
		renderComponent(story => {
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
			// A StoryInit passage already exists with author content.
			story.passages[0].visual = undefined;
			story.passages.push({
				...story.passages[0],
				height: 100,
				id: 'story-init-id',
				left: 0,
				name: 'StoryInit',
				selected: false,
				story: story.id,
				text: 'Author note.',
				top: 0,
				width: 100
			});
		});

		// Editing a state must not add a second StoryInit passage.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.defaultValue'),
			{target: {value: '5'}}
		);

		expect(storyInitCount()).toBe(1);
		// The author's content is preserved, not overwritten by an empty visual
		// passage being placed over it.
		expect(
			screen.getByTestId('passage-story-init-id')
		).toHaveTextContent('Author note.');
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
						condition: cond('>', 'state-1', 2),
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
		expect(passageText()).toHaveTextContent('$Trust += 1');
		expect(passageText()).toHaveTextContent('($Trust > 2)');

		// Changing the type to list strips both; the set action survives.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.stateType'),
			{target: {value: 'list'}}
		);

		expect(passageText()).not.toHaveTextContent('$Trust += 1');
		expect(passageText()).not.toHaveTextContent('gt 2');
		expect(passageText()).toHaveTextContent('$Trust = 0');
	});

	it('clears a set block variable id when its state is deleted', () => {
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
						id: 'set-1',
						kind: 'set',
						operation: '+=',
						variableId: 'state-1',
						value: {kind: 'literal', value: 1},
						condition: cond('>', 'state-1', 0)
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

		// The set block compiles while its state exists.
		expect(passageText()).toHaveTextContent('<<if ($Trust > 0)>><<set $Trust += 1>><</if>>');

		// Deleting the state clears the block's variable id (it stops compiling)
		// and strips the condition on the deleted state.
		fireEvent.click(screen.getByText('×'));

		expect(passageText()).not.toHaveTextContent('<<set');
		expect(passageText()).not.toHaveTextContent(/<<if/);
	});

	it('warns when a state name sanitizes to the same variable as another', () => {
		renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'},
					{defaultValue: 0, id: 'state-2', name: 'Other', type: 'number'}
				],
				version: 1
			};
		});

		// Renaming the second state to collide with the first's sanitized name.
		const nameInputs = screen.getAllByLabelText(
			'dialogs.passageEdit.visual.stateName'
		);

		expect(nameInputs).toHaveLength(2);
		fireEvent.change(nameInputs[1], {target: {value: 'Trust'}});

		// Both rows now share the sanitized name, so each shows the warning.
		// The mocked i18next echoes the key verbatim (no interpolation).
		expect(
			screen.getAllByText(
				'dialogs.passageEdit.visual.nameConflictWarning'
			).length
		).toBeGreaterThanOrEqual(1);
	});

	it('treats advance-time actions as compatible with any state situation', () => {
		// The action needs no state, so a missing state must not make it
		// incompatible (otherwise state deletion would silently strip it).
		expect(
			isActionCompatible({operation: 'advanceTime', stateId: '', value: 2})
		).toBe(true);
		expect(
			isActionCompatible({operation: 'advanceTime', stateId: '', value: 2}, {
				defaultValue: 1,
				id: 'day',
				name: 'day',
				type: 'number'
			})
		).toBe(true);
	});

	it('keeps an advance-time choice action when every state is deleted', () => {
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
			story.passages[1].name = 'Hallway';
			story.passages[0].visual = {
				blocks: [
					{
						actions: [
							{operation: 'advanceTime', stateId: '', value: 1},
							{operation: 'increase', stateId: 'state-1', value: 1}
						],
						id: 'choice-1',
						kind: 'choice',
						label: 'Keep walking',
						targetPassageId: story.passages[1].id
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

		// Both actions compile while the state exists.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent(/setup\.time\.advance\(1\).*\$Trust \+= 1/s);

		// Deleting the only state strips the state action but keeps the
		// time-system action.
		fireEvent.click(screen.getByText('×'));

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('setup.time.advance(1)');
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent('$Trust');
	});
});
