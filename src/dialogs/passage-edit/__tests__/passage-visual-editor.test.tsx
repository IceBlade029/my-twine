import {act, fireEvent, render, screen} from '@testing-library/react';
import type {TFunction} from 'i18next';
import * as React from 'react';
import {
	Story,
	useStoriesContext,
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
	evaluateCondition,
	hiddenBecauseText,
	PassageVisualEditor
} from '../passage-visual-editor';

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

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addVariableBlock')
		);

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
		).toHaveTextContent('<<print $nrp_state_1>>');
		expect(
			screen.queryByText('dialogs.passageEdit.visual.blockIncomplete')
		).not.toBeInTheDocument();
	});

	it('adds and completes an include block with a passage picker', () => {
		const {story} = renderComponent();

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addIncludeBlock')
		);

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

		fireEvent.click(
			screen.getByText('dialogs.passageEdit.visual.addInteractionBlock')
		);

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
			setup.passages[0].visual = {
				blocks: [
					{
						actions: [],
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

		// Selecting them compiles to the back/return macros without a setter.
		fireEvent.change(target, {target: {value: 'back'}});
		expect(passageText()).toHaveTextContent('<<back "Go back">>');

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
		const gates = container.querySelectorAll('.block-gate');

		expect(gates[0].querySelector('svg')).toBeInTheDocument();
		expect(gates[1].querySelector('svg')).toBeInTheDocument();
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
						condition: {
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 5
						},
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
			conditionSentenceText(
				tEn,
				{operator: 'equals', stateId: 'door', value: true},
				states
			)
		).toBe('When Door = true');
		expect(
			conditionSentenceText(
				tEn,
				{operator: 'greaterThan', stateId: 'trust', value: 5},
				states
			)
		).toBe('When Trust > 5');
		expect(
			conditionSentenceText(
				tZh,
				{operator: 'equals', stateId: 'door', value: false},
				states
			)
		).toBe('当【Door】= false时');
		expect(
			hiddenBecauseText(
				tZh,
				{operator: 'equals', stateId: 'door', value: false},
				states
			)
		).toBe('因【Door】= false而隐藏');
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

	it('evaluates conditions against simulated values', () => {
		const door = states[0];
		const trust = states[1];

		expect(
			evaluateCondition({operator: 'equals', stateId: 'door', value: true}, door, true)
		).toBe(true);
		expect(
			evaluateCondition({operator: 'notEquals', stateId: 'door', value: false}, door, false)
		).toBe(false);
		expect(
			evaluateCondition({operator: 'greaterThan', stateId: 'trust', value: 5}, trust, 0)
		).toBe(false);
		expect(
			evaluateCondition({operator: 'greaterThan', stateId: 'trust', value: 5}, trust, 7)
		).toBe(true);
		expect(
			evaluateCondition({operator: 'lessThan', stateId: 'trust', value: 5}, trust, 7)
		).toBe(false);
		// A condition referencing a deleted state never hides a block.
		expect(
			evaluateCondition({operator: 'equals', stateId: 'gone', value: 1}, undefined, 1)
		).toBe(true);
	});

	it('evaluates list conditions against simulated array values', () => {
		const inv: VisualStoryState = {
			defaultValue: [],
			id: 'inv',
			name: 'Inventory',
			type: 'list'
		};

		expect(
			evaluateCondition(
				{operator: 'includes', stateId: 'inv', value: 'key'},
				inv,
				['key', 'torch']
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{operator: 'includes', stateId: 'inv', value: 'map'},
				inv,
				['key', 'torch']
			)
		).toBe(false);
		expect(
			evaluateCondition(
				{operator: 'notIncludes', stateId: 'inv', value: 'map'},
				inv,
				['key', 'torch']
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{operator: 'notIncludes', stateId: 'inv', value: 'key'},
				inv,
				['key', 'torch']
			)
		).toBe(false);
		// A non-array simulated value never hides a list condition.
		expect(
			evaluateCondition(
				{operator: 'includes', stateId: 'inv', value: 'key'},
				inv,
				'key'
			)
		).toBe(true);
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
						condition: {
							operator: 'equals',
							stateId: 'state-1',
							value: 'key'
						},
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
						condition: {
							operator: 'greaterThan',
							stateId: 'state-1',
							value: 5
						},
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

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.simulatorToggle'));

		// The default value (0) does not satisfy Trust > 5: the block is dimmed
		// and annotated as hidden.
		expect(body()).toHaveClass('is-hidden');
		expect(
			screen.getByText('dialogs.passageEdit.visual.hiddenBecause')
		).toBeInTheDocument();

		// Setting a matching value restores the block.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: '7'}}
		);
		expect(body()).not.toHaveClass('is-hidden');
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
								condition: {
									operator: 'equals',
									stateId: 'state-1',
									value: 1
								},
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

		fireEvent.click(screen.getByText('dialogs.passageEdit.visual.simulatorToggle'));

		// Default 0 does not match Trust == 1, so the else branch is active.
		expect(branches()[0]).toHaveClass('is-inactive');
		expect(branches()[1]).not.toHaveClass('is-inactive');
		expect(
			screen.getByText('dialogs.passageEdit.visual.hiddenBecause')
		).toBeInTheDocument();

		// A matching value activates the first branch and dims the else branch.
		fireEvent.change(
			screen.getByLabelText('dialogs.passageEdit.visual.simulatorValue'),
			{target: {value: '1'}}
		);
		expect(branches()[0]).not.toHaveClass('is-inactive');
		expect(branches()[1]).toHaveClass('is-inactive');
		expect(screen.getByText('dialogs.passageEdit.visual.hidden')).toBeInTheDocument();
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
						condition: {
							operator: 'includes',
							stateId: 'state-1',
							value: 'map'
						},
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
			screen.getByText('dialogs.passageEdit.visual.simulatorToggle')
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
