import {act, fireEvent, render, screen, within} from '@testing-library/react';
import type {TFunction} from 'i18next';
import * as React from 'react';
import {
	Story,
	useStoriesContext,
	VisualBinaryOperator,
	VisualStoryState
} from '../../../store/stories';
import {
	fakeStory,
	FakeStateProvider,
	StoryInspector
} from '../../../test-util';
import enUS from '../../../../public/locales/en-US.json';
import zhCN from '../../../../public/locales/zh-CN.json';
import {
	actionSentenceText,
	conditionSentenceText,
	evaluateExpression,
	hiddenBecauseText,
	PassageVisualEditor
} from '../passage-visual-editor';


function cond(operator: VisualBinaryOperator, variableId: string, value: boolean | number | string) {
	return {
		kind: 'binary' as const,
		operator,
		left: {kind: 'variable' as const, variableId},
		right: {kind: 'literal' as const, value}
	};
}

const TestEditor = () => {
	const {stories} = useStoriesContext();
	const story = stories[0];
	const passage = story.passages[0];

	if (!passage.visual) {
		return (
			<>
				<span>no-visual-editor</span>
				<StoryInspector />
			</>
		);
	}

	return (
		<>
			<PassageVisualEditor passage={{...passage, visual: passage.visual}} story={story} />
			<StoryInspector />
		</>
	);
};

/** Closes the editor without unmounting the store, like the dialog's Escape. */
const TestUnmountingEditor = () => {
	const [open, setOpen] = React.useState(true);
	const {stories} = useStoriesContext();
	const story = stories[0];
	const passage = story.passages[0];

	return (
		<>
			<button onClick={() => setOpen(false)} type="button">
				close-visual-editor
			</button>
			{open && passage.visual && (
				<PassageVisualEditor
					passage={{...passage, visual: passage.visual}}
					story={story}
				/>
			)}
			<StoryInspector />
		</>
	);
};

function renderComponent(setup?: (story: Story) => void) {
	const story = fakeStory(2);

	story.passages[0].visual = {
		blocks: [{id: 'text-1', kind: 'text', text: ''}],
		version: 2
	};
	story.passages[1].name = 'Hallway';
	setup?.(story);
	const {container} = render(
		<FakeStateProvider stories={[story]}>
			<TestEditor />
		</FakeStateProvider>
	);
	return {container, story};
}

/**
 * Opens the single module selector and clicks the entry whose label key
 * matches `labelKey`. The mocked i18next echoes the key, so tests pass the
 * i18n key (e.g. 'dialogs.passageEdit.visual.blockKindChoice').
 */
function addModule(labelKey: string) {
	fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addModule'));
	fireEvent.click(screen.getAllByText(labelKey)[0]);
}

describe('<PassageVisualEditor>', () => {
	it('commits body text as generated passage text on blur', () => {
		const {story} = renderComponent();
		const body = screen.getByLabelText('dialogs.passageEdit.visual.body');

		fireEvent.change(body, {target: {value: 'A quiet room.'}});
		fireEvent.blur(body);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('A quiet room.');
	});

	it('adds and completes a choice without writing SugarCube syntax', () => {
		const {story} = renderComponent();

		addModule('dialogs.passageEdit.visual.blockKindChoice');
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

	it('adds and completes a variable block with a state picker', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
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
		});

		addModule('dialogs.passageEdit.visual.blockKindVariable');

		// The fresh block is visibly incomplete until a state is chosen.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindVariable')
		).toBeInTheDocument();

		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.variableState'),
			{target: {value: 'state-1'}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<print $Trust>>');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('adds and completes a raw block with a SugarCube textarea', () => {
		const {story} = renderComponent();

		addModule('dialogs.passageEdit.visual.blockKindRaw');

		// The fresh block is visibly incomplete until sugar is typed.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindRaw')
		).toBeInTheDocument();

		// Typing sugar compiles verbatim into the generated source.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.rawSugar'),
			{target: {value: '<<set $x = 1>>'}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<set $x = 1>>');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('disables the loop item source for variable blocks outside loops', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
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
		});

		addModule('dialogs.passageEdit.visual.blockKindVariable');

		// New variable blocks default to the state source: the state picker is
		// shown and the loop item hint is not.
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.variableState')
		).toBeInTheDocument();
		expect(
			screen.queryByText('dialogs.passageEdit.visual.loopItemHint')
		).not.toBeInTheDocument();

		const loopOption = screen
			.getByLabelText('dialogs.passageEdit.visual.variableSource')
			.querySelector('option[value="loopItem"]');

		expect(loopOption).toBeDisabled();
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent('<<print _item>>');
	});

	it('enables and compiles the loop item source inside a loop', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{
						defaultValue: ['a'],
						id: 'state-1',
						name: 'Inventory',
						type: 'list'
					}
				],
				version: 1
			};
			setup.passages[0].visual = {
				blocks: [
					{
						blocks: [
							{
								id: 'variable-1',
								kind: 'variable',
								source: 'loopItem',
								stateId: undefined
							}
						],
						id: 'loop-1',
						kind: 'loop',
						stateId: 'state-1'
					}
				],
				version: 2
			};
		});
		const source = screen.getByLabelText(
			'dialogs.passageEdit.visual.variableSource'
		);
		const loopOption = source
			.querySelector('option[value="loopItem"]');

		expect(loopOption).not.toBeDisabled();
		fireEvent.change(source, {target: {value: 'loopItem'}});
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent(
			'<<for _item range $Inventory>><<print _item>><</for>>'
		);
	});

	it('adds and completes an include block with a passage picker', () => {
		const {story} = renderComponent();

		addModule('dialogs.passageEdit.visual.blockKindInclude');

		// The fresh block is visibly incomplete until a passage is chosen.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindInclude')
		).toBeInTheDocument();

		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.includeTarget'),
			{target: {value: story.passages[1].id}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<include "Hallway">>');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('adds and completes an interaction block with an operation and content', () => {
		const {story} = renderComponent();

		addModule('dialogs.passageEdit.visual.blockKindInteraction');

		// The fresh block is visibly incomplete until a label is typed.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindInteraction')
		).toBeInTheDocument();

		// The operation select offers all three translated operations and the
		// content textarea is present.
		const operation = screen.getByLabelText(
			'dialogs.passageEdit.visual.interactionOperation'
		);

		expect(operation).toHaveTextContent(
			'dialogs.passageEdit.visual.operationReveal'
		);
		expect(operation).toHaveTextContent(
			'dialogs.passageEdit.visual.operationAppend'
		);
		expect(operation).toHaveTextContent(
			'dialogs.passageEdit.visual.interactionOperationRemove'
		);
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.interactionContent')
		).toBeInTheDocument();

		// Typing a label completes the block; the generated source links to a
		// hook id derived from the block id.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.interactionLabel'),
			{target: {value: 'Reveal'}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.interactionContent'),
			{target: {value: 'A secret.'}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<link "Reveal">><<replace "#nrp_hook_');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('lets a choice target back or return instead of a passage', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			setup.passages[0].visual = {
				blocks: [
					{
						actions: [
							{operation: 'set', stateId: 'state-1', value: 1}
						],
						id: 'choice-1',
						kind: 'choice',
						label: 'Go back',
						targetPassageId: ''
					}
				],
				version: 2
			};
		});
		const passageText = () =>
			screen.getByTestId(`passage-${story.passages[0].id}`);
		const target = screen.getByLabelText(
			'dialogs.passageEdit.visual.choiceTarget'
		);

		// Back and Return appear alongside the passage options.
		expect(target).toHaveTextContent(
			'dialogs.passageEdit.visual.targetBack'
		);
		expect(target).toHaveTextContent(
			'dialogs.passageEdit.visual.targetReturn'
		);

		// Selecting them compiles to the back/return macros and hides actions.
		fireEvent.change(target, {target: {value: 'back'}});
		expect(passageText()).toHaveTextContent('<<back "Go back">>');
		expect(passageText()).not.toHaveTextContent('$Trust = 1');
		expect(
			screen.getByText(
				'dialogs.passageEdit.visual.specialTargetActionsUnavailable'
			)
		).toBeInTheDocument();
		expect(
			screen.queryByText('dialogs.passageEdit.visual.addAction')
		).not.toBeInTheDocument();

		fireEvent.change(target, {target: {value: 'return'}});
		expect(passageText()).toHaveTextContent('<<return "Go back">>');

		// Selecting a passage clears the special target again.
		fireEvent.change(target, {target: {value: story.passages[1].id}});
		expect(passageText()).toHaveTextContent('[[Go back->Hallway]]');
	});

	it('no longer manages story states and hints at the story states dialog when there are none', () => {
		renderComponent();

		// State management has moved out of the passage editor.
		expect(
			screen.queryByText('dialogs.passageEdit.visual.addState')
		).not.toBeInTheDocument();
		expect(
			screen.queryByLabelText('dialogs.passageEdit.visual.stateName')
		).not.toBeInTheDocument();

		// With no states, adding a condition is disabled and shows a hint.
		expect(
			screen.getByText('dialogs.passageEdit.visual.addCondition')
		).toBeDisabled();
		expect(
			screen.getByText('dialogs.passageEdit.visual.noStatesHint')
		).toBeInTheDocument();
	});

	it('switches to source editing after confirming the one-way change', () => {
		const {story} = renderComponent();
		const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.switchToSource'));

		expect(confirmSpy).toHaveBeenCalledWith(
			'dialogs.passageEdit.visual.switchToSourceConfirm'
		);
		expect(
			screen.queryByText('dialogs.passageEdit.visual.switchToSource')
		).not.toBeInTheDocument();
		expect(screen.getByText('no-visual-editor')).toBeInTheDocument();
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toBeInTheDocument();
		confirmSpy.mockRestore();
	});

	it('stays in the visual editor when the one-way switch is cancelled', () => {
		renderComponent();
		const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.switchToSource'));

		expect(
			screen.getByText('dialogs.passageEdit.visual.switchToSource')
		).toBeInTheDocument();
		expect(screen.queryByText('no-visual-editor')).not.toBeInTheDocument();
		confirmSpy.mockRestore();
	});

	it('adds and completes a switch block with cases', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Mood', type: 'number'},
					{
						defaultValue: ['a'],
						id: 'state-2',
						name: 'Inventory',
						type: 'list'
					}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindSwitch');

		// The fresh block is visibly incomplete until a state is chosen.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindSwitch')
		).toBeInTheDocument();

		// The state select only offers non-list states.
		const stateSelect = screen.getByLabelText(
			'dialogs.passageEdit.visual.switchState'
		);

		expect(stateSelect).not.toHaveTextContent('Inventory');
		fireEvent.change(stateSelect, {target: {value: 'state-1'}});
		expect(
			screen.getByText('dialogs.passageEdit.visual.statusIncomplete')
		).toBeInTheDocument();

		// Adding a case renders a value input and a nested block list; the
		// default section is always present.
		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.addCase'));
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.switchCaseValue')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.switchDefault')
		).toBeInTheDocument();

		// Typing the case value compiles into <<switch>> / <<case>> macros.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.switchCaseValue'),
			{target: {value: '1'}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent(
			'<<switch $Mood>><<case 1>><</switch>>'
		);
	});

	it('creates a branch with an editable condition and one final else', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindBranch');
		const addConditionButtons = screen.getAllByText(
			'dialogs.passageEdit.visual.addCondition'
		);
		expect(addConditionButtons.length).toBeGreaterThan(0);
		expect(
			screen.getAllByText('dialogs.passageEdit.visual.else')
		).toHaveLength(1);
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toHaveTextContent('<<if 1>>');

		fireEvent.click(addConditionButtons[addConditionButtons.length - 1]);
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.conditionState')
		).toBeInTheDocument();
	});

	it('adds and completes a loop block with a body', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: ['a'], id: 'state-1', name: 'Inventory', type: 'list'},
					{defaultValue: 0, id: 'state-2', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindLoop');

		// The fresh block is visibly incomplete until a list state is chosen.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindLoop')
		).toBeInTheDocument();

		// The state select only offers list states.
		const stateSelect = screen.getByLabelText(
			'dialogs.passageEdit.visual.loopState'
		);

		expect(stateSelect).not.toHaveTextContent('Trust');
		fireEvent.change(stateSelect, {target: {value: 'state-1'}});
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();

		// The body renders a nested block list: add a text block inside it.
		const loopBody = screen.getByLabelText(
			'dialogs.passageEdit.visual.loopBody'
		);

		fireEvent.click(
			within(loopBody).getByText('dialogs.passageEdit.visual.addModule')
		);
		fireEvent.click(
			within(loopBody).getByText(
				'dialogs.passageEdit.visual.blockKindText'
			)
		);
		const body = within(loopBody).getByLabelText(
			'dialogs.passageEdit.visual.body'
		);

		fireEvent.change(body, {target: {value: 'Item: '}});
		fireEvent.blur(body);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<for _item range $Inventory>>Item:<</for>>');
	});

	it('disables the loop module in the selector when no list variable exists', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addModule')
		);

		// 遍历列表 is disabled (and explained) when there is no list variable.
		const loopEntry = screen
			.getByText('dialogs.passageEdit.visual.blockKindLoop')
			.closest('button');

		expect(loopEntry).not.toBeNull();
		expect(loopEntry).toBeDisabled();
		expect(loopEntry).toHaveAttribute(
			'title',
			'dialogs.passageEdit.visual.noListStateSelectorReason'
		);
	});

	it('adds and completes a set variable block', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindSet');

		// The fresh block is visibly incomplete until a target is chosen.
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockIncomplete')
		).toBeInTheDocument();
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindSet')
		).toBeInTheDocument();

		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setVariable'),
			{target: {value: 'state-1'}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setOperation'),
			{target: {value: '+='}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setValue'),
			{target: {value: '1'}}
		);

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('<<set $Trust += 1>>');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('condition editor stores a binary expression', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			setup.passages[0].visual = {
				blocks: [
					{
						condition: cond('>', 'state-1', 5),
						id: 'text-1',
						kind: 'text',
						text: 'High.'
					}
				],
				version: 2
			};
		});

		// The condition editor exposes the state, operator symbols, and value.
		const operator = screen.getByLabelText(
			'dialogs.passageEdit.visual.conditionOperator'
		);

		expect(operator).toHaveTextContent('>');
		expect(operator).toHaveTextContent('≥');
		expect(operator).toHaveTextContent('<');
		expect(operator).toHaveTextContent('≤');
	});

	it('renders block shells with a data-depth attribute and a kind icon', () => {
		const {container} = renderComponent(story => {
			story.passages[0].visual = {
				blocks: [
					{
						branches: [
							{blocks: [{id: 't1', kind: 'text', text: 'A'}], id: 'b1'},
							{blocks: [], id: 'b2'}
						],
						id: 'branch-1',
						kind: 'branch'
					}
				],
				version: 2
			};
		});

		// Nested block lists increment the depth attribute.
		const depths = [...container.querySelectorAll('.visual-block')].map(
			element => element.getAttribute('data-depth')
		);
		expect(depths).toEqual(['0', '1']);

		// Every block gate renders the kind icon next to the label.
		const gates = container.querySelectorAll('.block-summary-button');

		expect(gates[0].querySelector('svg')).toBeInTheDocument();
		expect(gates[1].querySelector('svg')).toBeInTheDocument();
	});

	it('lets ordinary blocks expand independently and toggle closed', () => {
		const {container} = renderComponent(story => {
			story.passages[0].visual = {
				blocks: [
					{id: 'text-1', kind: 'text', text: 'First'},
					{id: 'text-2', kind: 'text', text: 'Second'}
				],
				version: 2
			};
		});
		const blocks = container.querySelectorAll('.visual-block');
		const body = (index: number) =>
			blocks[index].querySelector('.visual-block-body');

		expect(body(0)).toHaveClass('is-collapsed');
		expect(body(1)).toHaveClass('is-collapsed');

		fireEvent.click(blocks[0].querySelector('.block-summary-button') as Element);
		expect(body(0)).not.toHaveClass('is-collapsed');
		expect(blocks[0]).toHaveClass('is-selected');

		fireEvent.click(blocks[1].querySelector('.block-summary-button') as Element);
		expect(body(0)).not.toHaveClass('is-collapsed');
		expect(body(1)).not.toHaveClass('is-collapsed');
		expect(blocks[1]).toHaveClass('is-selected');

		fireEvent.click(blocks[0].querySelector('.block-summary-button') as Element);
		expect(body(0)).toHaveClass('is-collapsed');
		expect(body(1)).not.toHaveClass('is-collapsed');
		expect(blocks[0]).toHaveClass('is-selected');
	});

	it('collapses containers independently while retaining their structure summary', () => {
		const {container} = renderComponent(story => {
			story.passages[0].visual = {
				blocks: [
					{
						branches: [
							{blocks: [{id: 't1', kind: 'text', text: 'A'}], id: 'b1'},
							{blocks: [], id: 'b2'}
						],
						id: 'branch-1',
						kind: 'branch'
					},
					{blocks: [{id: 't2', kind: 'text', text: 'B'}], id: 'loop-1', kind: 'loop', stateId: ''}
				],
				version: 2
			};
		});
		const topBlocks = container.querySelectorAll(
			'.visual-block-list[data-depth="0"] > .visual-block'
		);

		expect(topBlocks[0]).toHaveClass('is-expanded');
		expect(topBlocks[1]).toHaveClass('is-expanded');
		expect(
			topBlocks[0].querySelector('.block-structure-summary')
		).toHaveTextContent('dialogs.passageEdit.visual.summaryBranch');

		fireEvent.click(
			within(topBlocks[0] as HTMLElement).getByLabelText('common.collapse')
		);
		expect(topBlocks[0]).toHaveClass('is-compact');
		expect(topBlocks[1]).toHaveClass('is-expanded');
	});

	it('shows a read-only initialization preview when editing the StoryInit passage with states', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			story.passages[0].name = 'StoryInit';
		});

		// The preview section renders a translated label.
		expect(
			screen.getByText('dialogs.passageEdit.visual.storyInitPreview')
		).toBeInTheDocument();
		// And a read-only <pre> showing the generated initialization.
		const preview = container.querySelector('.story-init-preview pre');

		expect(preview).not.toBeNull();
		expect(preview?.textContent).toContain(
			'<<if ndef $Trust>><<set $Trust = 0>><</if>>'
		);
	});

	it('does not render the StoryInit preview for other passage names', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			// passages[0] keeps its default name, not "StoryInit".
		});

		expect(
			screen.queryByText('dialogs.passageEdit.visual.storyInitPreview')
		).not.toBeInTheDocument();
		expect(container.querySelector('.story-init-preview')).toBeNull();
	});
});

describe('module selector (P2)', () => {
	it('opens the grouped selector from a single insert button and adds a module', () => {
		const {story} = renderComponent();

		// No per-kind add buttons remain, only the single insert button.
		expect(
			screen.queryByText('dialogs.passageEdit.visual.addChoice')
		).not.toBeInTheDocument();

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addModule')
		);

		// The selector is grouped: 常用 holds the text/choice/branch/set.
		const groups = screen.getAllByText(
			'dialogs.passageEdit.visual.selectorGroupCommon'
		);
		expect(groups.length).toBeGreaterThanOrEqual(1);
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindChoice')
		).toBeInTheDocument();
		expect(
			screen.getByText(
				'dialogs.passageEdit.visual.moduleChoiceDescription'
			)
		).toBeInTheDocument();

		// Selecting an entry inserts that module at the end of the list.
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.blockKindChoice')
		);
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.choiceLabel')
		).toBeInTheDocument();
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toBeInTheDocument();
	});

	it('filters selector entries by technical alias', () => {
		const {container} = renderComponent();

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addModule')
		);
		const countEntries = () =>
			container.querySelectorAll('.module-entry').length;

		expect(countEntries()).toBeGreaterThan(1);

		// Searching the alias "switch" leaves only the 多路分支 entry.
		fireEvent.change(
			screen.getByLabelText(
				'dialogs.passageEdit.visual.moduleSearchPlaceholder'
			),
			{target: {value: 'switch'}}
		);

		expect(countEntries()).toBe(1);
		expect(
			screen.getByText('dialogs.passageEdit.visual.blockKindSwitch')
		).toBeInTheDocument();
	});

	it('enables a loop module once a list variable exists', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: ['a'], id: 'state-1', name: 'Inv', type: 'list'}
				],
				version: 1
			};
		});

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addModule')
		);

		const loopEntry = screen
			.getByText('dialogs.passageEdit.visual.blockKindLoop')
			.closest('button');

		expect(loopEntry).not.toBeNull();
		expect(loopEntry).not.toBeDisabled();
	});
});

describe('condition dual view (P2)', () => {
	function renderConditioned() {
		return renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						condition: cond('>', 'state-1', 5),
						id: 'text-1',
						kind: 'text',
						text: 'Hi.'
					}
				],
				version: 2
			};
		});
	}

	it('toggles builder/expression and round-trips the simple shape', () => {
		renderConditioned();

		// Starts in builder mode with the three controls.
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.conditionState')
		).toBeInTheDocument();

		// Switch to expression mode: a textarea shows the serialized code.
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.expressionMode')
		);
		const code = screen.getByLabelText(
			'dialogs.passageEdit.visual.expressionSymbol'
		);

		expect(code).toBeInTheDocument();
		expect((code as HTMLTextAreaElement).value).toContain('$Trust');
		expect(
			screen.queryByLabelText('dialogs.passageEdit.visual.conditionState')
		).not.toBeInTheDocument();

		// Back to builder: the simple shape parses and the controls return.
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.builderMode')
		);
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.conditionState')
		).toBeInTheDocument();
	});

	it('shows a read-only note for a complex free expression', () => {
		renderComponent(story => {
			story.passages[0].visual = {
				blocks: [
					{
						condition: {
							code: '$a > 1 && $b < 2',
							kind: 'free'
						},
						id: 'text-1',
						kind: 'text',
						text: 'Hi.'
					}
				],
				version: 2
			};
		});

		// Advanced free expressions open in expression mode with the note.
		expect(
			screen.getByText('dialogs.passageEdit.visual.advancedSyntaxNote')
		).toBeInTheDocument();
		expect(
			screen.getByLabelText(
				'dialogs.passageEdit.visual.expressionSymbol'
			)
		).toBeInTheDocument();
	});

	it('shows instant feedback under the editor', () => {
		renderConditioned();

		// Default Trust is 0, so (Trust > 5) is false for the current test value.
		expect(
			screen.getByText(/currentTestValue/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/readsVariables/)
		).toBeInTheDocument();
	});
});

describe('set block value sources (P2)', () => {
	it('only offers += and -= for number targets', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: '', id: 'state-text', name: 'Title', type: 'text'},
					{defaultValue: 0, id: 'state-number', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindSet');
		const target = screen.getByLabelText(
			'dialogs.passageEdit.visual.setVariable'
		);
		const operation = screen.getByLabelText(
			'dialogs.passageEdit.visual.setOperation'
		);

		fireEvent.change(target, {target: {value: 'state-text'}});
		expect(operation).not.toHaveTextContent('+=');
		expect(operation).not.toHaveTextContent('-=');

		fireEvent.change(target, {target: {value: 'state-number'}});
		expect(operation).toHaveTextContent('+=');
		expect(operation).toHaveTextContent('-=');
	});

	it('offers value sources but disables 循环项 outside loops', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'},
					{defaultValue: 2, id: 'state-2', name: 'Gold', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindSet');
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setVariable'),
			{target: {value: 'state-1'}}
		);

		const source = screen.getByLabelText(
			'dialogs.passageEdit.visual.valueSource'
		);

		expect(source).toHaveTextContent(
			'dialogs.passageEdit.visual.valueSourceConstant'
		);
		expect(source).toHaveTextContent(
			'dialogs.passageEdit.visual.valueSourceVariable'
		);
		expect(source).toHaveTextContent(
			'dialogs.passageEdit.visual.valueSourceLoopItem'
		);
		expect(source).toHaveTextContent(
			'dialogs.passageEdit.visual.valueSourceFreeExpression'
		);
		expect(source.querySelector('option[value="loopItem"]')).toBeDisabled();

		// Constant source shows the type-aware literal input.
		expect(
			screen.getByLabelText('dialogs.passageEdit.visual.setValue')
		).toBeInTheDocument();

		// Variable source picks another story state.
		fireEvent.change(source, {target: {value: 'variable'}});
		fireEvent.change(
			screen.getByLabelText(
				'dialogs.passageEdit.visual.valueSourceVariable'
			),
			{target: {value: 'state-2'}}
		);

		// Free expression source shows a text input.
		fireEvent.change(source, {target: {value: 'free'}});
		fireEvent.change(
			screen.getByLabelText(
				'dialogs.passageEdit.visual.valueFreeExpression'
			),
			{target: {value: '$Gold + 1'}}
		);
	});

	it('renders a "$name op value" structure summary with a test result', () => {
		renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 1, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
		});

		addModule('dialogs.passageEdit.visual.blockKindSet');
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setVariable'),
			{target: {value: 'state-1'}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setOperation'),
			{target: {value: '+='}}
		);
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.setValue'),
			{target: {value: '4'}}
		);

		// The summary line "$Trust += 4" and a "1 -> 5" test result appear.
		expect(document.querySelector('.set-summary')).toHaveTextContent(
			'$Trust += 4'
		);
		expect(
			screen.getByText(/testResult/)
		).toBeInTheDocument();
		expect(document.querySelector('.set-test-result')).toHaveTextContent(
			'1 -> 5'
		);
	});
});

describe('per-block code preview (P2)', () => {
	it('shows the compiled fragment for a single block', () => {
		const {story} = renderComponent(setup => {
			setup.visual = {
				states: [
					{defaultValue: 1, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			setup.passages[0].visual = {
				blocks: [
					{
						id: 'set-1',
						kind: 'set',
						operation: '+=',
						variableId: 'state-1',
						value: {kind: 'literal', value: 1}
					},
					{
						id: 'raw-1',
						kind: 'raw',
						sugar: '<<set $x = 1>>'
					}
				],
				version: 2
			};
		});

		// Two blocks, one shared code toggle in each toolbar.
		const codeButtons = screen.getAllByRole('button', {
			name: 'dialogs.passageEdit.visual.blockCode'
		});

		expect(codeButtons.length).toBe(2);

		// Opening the preview on the raw block shows only that block's code.
		fireEvent.click(codeButtons[1]);
		const previews = document.querySelectorAll('.block-code-preview');

		expect(previews.length).toBe(1);
		expect(previews[0].textContent).toContain('<<set $x = 1>>');

		// The compiled fragment still works for the story's passages.
		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).not.toBeNull();
	});
});

describe('human-readable conditions and actions', () => {
	// Real i18next instances resolve the sentence templates from the locale
	// files, so these assertions check the exact rendered sentences.
	let tEn: TFunction;
	let tZh: TFunction;

	const states: VisualStoryState[] = [
		{defaultValue: false, id: 'door', name: 'Door', type: 'boolean'},
		{defaultValue: 0, id: 'trust', name: 'Trust', type: 'number'}
	];

	beforeAll(async () => {
		// The auto-mocked i18next only echoes keys, so load the real module
		// (and its real translations) for the sentence assertions.
		const realI18next = jest.requireActual(
			'i18next'
		) as typeof import('i18next')['default'];
		const en = realI18next.createInstance();
		const zh = realI18next.createInstance();

		await Promise.all([
			en.init({
				fallbackLng: 'en-US',
				initImmediate: false,
				interpolation: {escapeValue: false},
				lng: 'en-US',
				resources: {'en-US': {translation: enUS}}
			}),
			zh.init({
				fallbackLng: 'zh-CN',
				initImmediate: false,
				interpolation: {escapeValue: false},
				lng: 'zh-CN',
				resources: {'zh-CN': {translation: zhCN}}
			})
		]);
		tEn = en.t.bind(en);
		tZh = zh.t.bind(zh);
	});

	it('renders a live condition sentence for a gated block', () => {
		renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						condition: cond('>', 'state-1', 5),
						id: 'text-1',
						kind: 'text',
						text: 'Hello.'
					}
				],
				version: 2
			};
		});

		// The sentence appears in the block gate bar and in the condition area.
		expect(
			screen.getAllByText('dialogs.passageEdit.visual.conditionSentence')
				.length
		).toBeGreaterThanOrEqual(1);
	});

	it('formats condition and action sentences with the correct words', () => {
		expect(
			conditionSentenceText(tEn, cond('==', 'door', true), states)
		).toBe('When Door = true');
		expect(
			conditionSentenceText(tEn, cond('>', 'trust', 5), states)
		).toBe('When Trust > 5');
		expect(
			conditionSentenceText(tZh, cond('==', 'door', false), states)
		).toBe('当【Door】= false时');
		expect(hiddenBecauseText(tZh, cond('==', 'door', false), states)).toBe(
			'因【Door】= false而隐藏'
		);
		expect(
			actionSentenceText(
				tEn,
				{operation: 'set', stateId: 'trust', value: 3},
				states
			)
		).toBe('After choosing: Trust set to 3');
		expect(
			actionSentenceText(
				tZh,
				{operation: 'increase', stateId: 'trust', value: 1},
				states
			)
		).toBe('点击后：【Trust】加 『1』');
	});

	it('evaluates expressions against simulated values', () => {
		expect(
			evaluateExpression(cond('==', 'door', true), states, {door: true})
		).toBe(true);
		expect(
			evaluateExpression(cond('!=', 'door', false), states, {door: false})
		).toBe(false);
		expect(
			evaluateExpression(cond('>', 'trust', 5), states, {trust: 0})
		).toBe(false);
		expect(
			evaluateExpression(cond('>', 'trust', 5), states, {trust: 7})
		).toBe(true);
		expect(
			evaluateExpression(cond('<', 'trust', 5), states, {trust: 7})
		).toBe(false);
		expect(
			evaluateExpression(cond('>=', 'trust', 5), states, {trust: 5})
		).toBe(true);
		expect(
			evaluateExpression(cond('<=', 'trust', 5), states, {trust: 4})
		).toBe(true);

		// A variable missing from the simulation falls back to its default.
		expect(
			evaluateExpression(cond('>', 'trust', 5), states, {})
		).toBe(false);

		// A condition referencing a deleted state cannot be determined: it
		// must not hide a block (undefined).
		expect(
			evaluateExpression(cond('==', 'gone', 1), states, {})
		).toBeUndefined();

		// A loop item or free expression cannot be evaluated.
		expect(
			evaluateExpression({kind: 'loopItem'}, states, {})
		).toBeUndefined();
		expect(
			evaluateExpression({kind: 'free', code: '$trust > 1'}, states, {trust: 5})
		).toBeUndefined();
	});

	it('evaluates list expressions against simulated array values', () => {
		const inv: VisualStoryState = {
			defaultValue: [],
			id: 'inv',
			name: 'Inventory',
			type: 'list'
		};
		const allStates = [inv];
		const values = {inv: ['key', 'torch']};

		expect(
			evaluateExpression(cond('includes', 'inv', 'key'), allStates, values)
		).toBe(true);
		expect(
			evaluateExpression(cond('includes', 'inv', 'map'), allStates, values)
		).toBe(false);
		expect(
			evaluateExpression(cond('notIncludes', 'inv', 'map'), allStates, values)
		).toBe(true);
		expect(
			evaluateExpression(cond('notIncludes', 'inv', 'key'), allStates, values)
		).toBe(false);
		// A non-array simulated value cannot be determined (undefined): it
		// must not hide a list expression.
		expect(
			evaluateExpression(cond('includes', 'inv', 'key'), allStates, {inv: 'key'})
		).toBeUndefined();
	});

	it('offers list operators in the condition editor for list states', () => {
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
			story.passages[0].visual = {
				blocks: [
					{
						condition: cond('==', 'state-1', 'key'),
						id: 'text-1',
						kind: 'text',
						text: 'Hello.'
					}
				],
				version: 2
			};
		});

		const select = screen.getByLabelText(
			'dialogs.passageEdit.visual.conditionOperator'
		);

		expect(select).toHaveTextContent(
			'dialogs.passageEdit.visual.operatorIncludes'
		);
		expect(select).toHaveTextContent(
			'dialogs.passageEdit.visual.operatorNotIncludes'
		);
		// Numeric-only operators are hidden for list states.
		expect(select).not.toHaveTextContent('>');
		expect(select).not.toHaveTextContent('<');
	});

	it('offers list operations in the action editor for list states', () => {
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
			story.passages[0].visual = {
				blocks: [
					{
						actions: [
							{operation: 'set', stateId: 'state-1', value: 'key'}
						],
						id: 'choice-1',
						kind: 'choice',
						label: 'Take',
						targetPassageId: story.passages[1].id
					}
				],
				version: 2
			};
		});

		const select = screen.getByLabelText(
			'dialogs.passageEdit.visual.actionOperation'
		);

		expect(select).toHaveTextContent(
			'dialogs.passageEdit.visual.operationPush'
		);
		expect(select).toHaveTextContent(
			'dialogs.passageEdit.visual.operationRemove'
		);
		expect(select).toHaveTextContent(
			'dialogs.passageEdit.visual.operationClear'
		);
		// Numeric-only operations are hidden for list states.
		expect(select).not.toHaveTextContent(
			'dialogs.passageEdit.visual.operationIncrease'
		);
	});
});

describe('simulator', () => {
	it('dims a gated block when the simulated state value does not match', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						condition: cond('>', 'state-1', 5),
						id: 'text-1',
						kind: 'text',
						text: 'Secret.'
					}
				],
				version: 2
			};
		});
		const body = () => container.querySelector('.visual-block-body');

		// The simulator starts closed: no dimming.
		expect(body()).not.toHaveClass('is-hidden');

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.runtimeDrawer'));

		// The default value (0) does not satisfy Trust > 5: the block is dimmed
		// and annotated as hidden.
		expect(body()).toHaveClass('is-hidden');
		expect(
			screen.getByText('dialogs.passageEdit.visual.statusHidden')
		).toBeInTheDocument();

		// Setting a matching value restores the block.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: '7'}}
		);
		expect(body()).not.toHaveClass('is-hidden');
	});

	it('dims non-matching switch cases and keeps the matching case active', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Mood', type: 'number'}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						cases: [
							{
								blocks: [{id: 't1', kind: 'text', text: 'Happy.'}],
								id: 'c1',
								value: 1
							},
							{
								blocks: [{id: 't2', kind: 'text', text: 'Neutral.'}],
								id: 'c2',
								value: 0
							}
						],
						defaultBlocks: [{id: 't3', kind: 'text', text: 'Unknown.'}],
						id: 'switch-1',
						kind: 'switch',
						stateId: 'state-1'
					}
				],
				version: 2
			};
		});
		const cases = () => container.querySelectorAll('.switch-case');
		const defaultSection = () => container.querySelector('.switch-default');

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);

		// The default value 0 matches the second case: the first case and the
		// default section are dimmed, the matching case is not.
		expect(cases()[0]).toHaveClass('is-inactive');
		expect(cases()[1]).not.toHaveClass('is-inactive');
		expect(defaultSection()).toHaveClass('is-inactive');

		// A value matching no case activates the default section instead.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: '5'}}
		);
		expect(cases()[0]).toHaveClass('is-inactive');
		expect(cases()[1]).toHaveClass('is-inactive');
		expect(defaultSection()).not.toHaveClass('is-inactive');
	});

	it('dims inactive branches and keeps the matching branch active', () => {
		const {container} = renderComponent(story => {
			story.visual = {
				states: [
					{defaultValue: 0, id: 'state-1', name: 'Trust', type: 'number'}
				],
				version: 1
			};
			story.passages[0].visual = {
				blocks: [
					{
						branches: [
							{
								blocks: [{id: 't1', kind: 'text', text: 'A'}],
								condition: cond('==', 'state-1', 1),
								id: 'b1'
							},
							{blocks: [{id: 't2', kind: 'text', text: 'B'}], id: 'b2'}
						],
						id: 'branch-1',
						kind: 'branch'
					}
				],
				version: 2
			};
		});
		const branches = () =>
			container.querySelectorAll('.visual-passage-branch .branch');

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.runtimeDrawer'));

		// Default 0 does not match Trust == 1, so the else branch is active.
		expect(branches()[0]).toHaveClass('is-inactive');
		expect(branches()[1]).not.toHaveClass('is-inactive');
		expect(
			screen.getByText('dialogs.passageEdit.visual.statusNotHit')
		).toBeInTheDocument();

		// A matching value activates the first branch and dims the else branch.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: '1'}}
		);
		expect(branches()[0]).not.toHaveClass('is-inactive');
		expect(branches()[1]).toHaveClass('is-inactive');
		expect(
			screen.getByText('dialogs.passageEdit.visual.statusNotHit')
		).toBeInTheDocument();
	});

	it('simulates list state values from comma-separated input', () => {
		const {container} = renderComponent(story => {
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
			story.passages[0].visual = {
				blocks: [
					{
						condition: cond('includes', 'state-1', 'map'),
						id: 'text-1',
						kind: 'text',
						text: 'You have a map.'
					}
				],
				version: 2
			};
		});
		const body = () => container.querySelector('.visual-block-body');

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);

		// The default (['key']) does not include 'map': the block is hidden.
		expect(body()).toHaveClass('is-hidden');

		// Typing comma-separated items restores the block.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: 'map, torch'}}
		);
		expect(body()).not.toHaveClass('is-hidden');

		// Clearing the input hides it again.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: ''}}
		);
		expect(body()).toHaveClass('is-hidden');
	});
});

describe('save-on-change', () => {
	it('debounces body text saves while typing', () => {
		jest.useFakeTimers();
		try {
			const {story} = renderComponent();
			const body = screen.getByLabelText('dialogs.passageEdit.visual.body');

			fireEvent.change(body, {target: {value: 'Typed without blur.'}});

			// Not committed yet: the save is pending and the indicator shows it.
			expect(
				screen.getByTestId(`passage-${story.passages[0].id}`)
			).not.toHaveTextContent('Typed without blur.');
			expect(
				screen.getByText('dialogs.passageEdit.visual.saving')
			).toBeInTheDocument();

			act(() => {
				jest.advanceTimersByTime(300);
			});

			expect(
				screen.getByTestId(`passage-${story.passages[0].id}`)
			).toHaveTextContent('Typed without blur.');
			expect(
				screen.getByText('dialogs.passageEdit.visual.saved')
			).toBeInTheDocument();
		} finally {
			jest.useRealTimers();
		}
	});

	it('commits typed body text when the editor unmounts without blur', () => {
		const story = fakeStory(2);

		story.passages[0].visual = {
			blocks: [{id: 'text-1', kind: 'text', text: ''}],
			version: 2
		};
		story.passages[1].name = 'Hallway';
		render(
			<FakeStateProvider stories={[story]}>
				<TestUnmountingEditor />
			</FakeStateProvider>
		);

		fireEvent.change(screen.getByLabelText('dialogs.passageEdit.visual.body'), {
			target: {value: 'Escape-proof text.'}
		});
		fireEvent.click(screen.getByText('close-visual-editor'));

		expect(
			screen.getByTestId(`passage-${story.passages[0].id}`)
		).toHaveTextContent('Escape-proof text.');
	});
});

describe('运行检查 runtime drawer (P3)', () => {
	/**
	 * Captures the 'message' handler the drawer registers on window, returning
	 * a function that invokes it directly with a payload (the usual way to mock
	 * the sandboxed iframe's postMessage round-trip).
	 */
	function captureMessageHandler(): (payload: Record<string, unknown>) => void {
		const addSpy = jest.spyOn(window, 'addEventListener');
		let handler: ((event: MessageEvent) => void) | undefined;

		return payload => {
			if (!handler) {
				addSpy.mock.calls.forEach(args => {
					if (args[0] === 'message') {
						handler = args[1] as (e: MessageEvent) => void;
					}
				});
			}

			if (!handler) {
				throw new Error('no message handler registered');
			}

			act(() => {
				handler!({data: payload} as MessageEvent);
			});
		};
	}

	it('renders the four tabs and a run button', () => {
		renderComponent(story => {
			story.passages[0].visual = {
				blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
				version: 2
			};
		});
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);

		// The 运行 button and all four tabs exist.
		expect(
			screen.getByRole('button', {name: 'dialogs.passageEdit.visual.runButton'})
		).toBeInTheDocument();
		expect(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabState'})
		).toBeInTheDocument();
		expect(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabRender'})
		).toBeInTheDocument();
		expect(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabTrace'})
		).toBeInTheDocument();
		expect(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabSugar'})
		).toBeInTheDocument();
	});

	it('clicking a trace entry highlights its block in the tree', () => {
		const {container} = renderComponent(story => {
			story.passages[0].visual = {
				blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
				version: 2
			};
		});

		const runner = captureMessageHandler();

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);
		fireEvent.click(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabTrace'})
		);

		// No trace yet -> hint is shown.
		expect(
			screen.getByText('dialogs.passageEdit.visual.runHint')
		).toBeInTheDocument();

		// Simulate the sandbox runtime posting a result back.
		runner({
			type: 'narrative-test-result',
			before: {Trust: 0},
			after: {Trust: 3},
			html: '<p>Hello.</p>',
			trace: [{b: 'text-1', ev: 's'}, {b: 'text-1', ev: 'e'}]
		});

		// A block trace entry is clickable (start/end markers).
		const blockEntry = container.querySelector(
			'.run-trace-entry.run-trace-clickable'
		);

		expect(blockEntry).not.toBeNull();

		// Clicking it selects the block: the shell gains the highlight class.
		fireEvent.click(blockEntry as Element);
		const selectedBlocks = container.querySelectorAll(
			'.visual-block.is-selected'
		);

		expect(selectedBlocks.length).toBe(1);
		expect(
			selectedBlocks[0].querySelector('.block-kind')
		).toBeInTheDocument();

		// Clicking again toggles the selection off.
		fireEvent.click(blockEntry as Element);
		expect(
			container.querySelectorAll('.visual-block.is-selected').length
		).toBe(0);
	});

	it('opens collapsed ancestors and expands a nested block selected from trace', () => {
		const {container} = renderComponent(story => {
			story.passages[0].visual = {
				blocks: [
					{
						branches: [
							{blocks: [{id: 'nested-text', kind: 'text', text: 'Inside'}], id: 'b1'},
							{blocks: [], id: 'b2'}
						],
						id: 'branch-1',
						kind: 'branch'
					}
				],
				version: 2
			};
		});
		const branch = container.querySelector(
			'.visual-block[data-depth="0"]'
		) as HTMLElement;

		fireEvent.click(within(branch).getByLabelText('common.collapse'));
		expect(branch).toHaveClass('is-compact');

		const runner = captureMessageHandler();
		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);
		fireEvent.click(
			screen.getByRole('tab', {name: 'dialogs.passageEdit.visual.runTabTrace'})
		);
		runner({
			type: 'narrative-test-result',
			before: {},
			after: {},
			html: '<p>Inside</p>',
			trace: [{b: 'nested-text', ev: 's'}]
		});
		fireEvent.click(
			container.querySelector(
				'.run-trace-entry.run-trace-clickable'
			) as Element
		);

		expect(branch).toHaveClass('is-expanded');
		const nested = container.querySelector(
			'.visual-block[data-depth="1"]'
		) as HTMLElement;
		expect(nested).toHaveClass('is-selected');
		expect(nested).toHaveClass('is-expanded');
		expect(nested.querySelector('.visual-block-body')).not.toHaveClass(
			'is-collapsed'
		);
	});

	it('casts an engine error into the runtime-error banner', () => {
		renderComponent(story => {
			story.passages[0].visual = {
				blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
				version: 2
			};
		});

		const runner = captureMessageHandler();

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.runtimeDrawer')
		);
		runner({
			type: 'narrative-test-error',
			message: 'engine exploded'
		});

		expect(screen.getByRole('alert')).toHaveTextContent('engine exploded');
	});
});
