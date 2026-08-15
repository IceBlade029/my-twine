import {v4 as uuid} from '@lukeed/uuid';
import {
	IconArrowDown,
	IconArrowsRight,
	IconArrowUp,
	IconCode,
	IconFileImport,
	IconGitBranch,
	IconPlus,
	IconPointer,
	IconSourceCode,
	IconTrash,
	IconTypography,
	IconVariable
} from '@tabler/icons';
import type {TFunction} from 'i18next';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	Passage,
	Story,
	VisualBlock,
	VisualBranch,
	VisualBranchBlock,
	VisualChoiceBlock,
	VisualCondition,
	VisualIncludeBlock,
	VisualInteractionBlock,
	VisualPassageContent,
	VisualPassageContentV2,
	VisualStateAction,
	VisualStoryState,
	VisualTextBlock,
	VisualVariableBlock,
	updatePassage
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	compileVisualPassage,
	migrateVisualContent
} from '../../util/visual-passage';
import {defaultValueForState, StateValueInput} from '../story-states';
import './passage-visual-editor.css';

/** Metadata describing one block kind, used by the shared block shell. */
interface BlockKindMeta {
	icon: React.ComponentType;
	labelKey: string;
}

/**
 * Registry of per-kind block metadata. Future block kinds (phases 7/8/9)
 * register their label and icon here instead of copy-pasting block headers.
 */
const blockKindMeta: Record<VisualBlock['kind'], BlockKindMeta> = {
	text: {
		icon: IconTypography,
		labelKey: 'dialogs.passageEdit.visual.blockKindText'
	},
	choice: {
		icon: IconArrowsRight,
		labelKey: 'dialogs.passageEdit.visual.blockKindChoice'
	},
	branch: {
		icon: IconGitBranch,
		labelKey: 'dialogs.passageEdit.visual.blockKindBranch'
	},
	variable: {
		icon: IconVariable,
		labelKey: 'dialogs.passageEdit.visual.blockKindVariable'
	},
	include: {
		icon: IconFileImport,
		labelKey: 'dialogs.passageEdit.visual.blockKindInclude'
	},
	interaction: {
		icon: IconPointer,
		labelKey: 'dialogs.passageEdit.visual.blockKindInteraction'
	}
};

/** A value a state can hold during simulation; list states hold string[]. */
type SimulatedValue = boolean | number | string | string[];

/**
 * Evaluates a condition against a simulated state value. A condition whose
 * state no longer exists evaluates to true so it never hides a block.
 * greaterThan/lessThan are only meaningful for numeric values; non-numeric
 * inputs are coerced with Number(). includes/notIncludes only apply to
 * arrays; a non-array simulated value evaluates to true so it never hides a
 * block.
 */
export function evaluateCondition(
	condition: VisualCondition,
	state: VisualStoryState | undefined,
	simulatedValue: SimulatedValue
): boolean {
	if (!state) {
		return true;
	}

	switch (condition.operator) {
		case 'equals':
			return simulatedValue === condition.value;
		case 'notEquals':
			return simulatedValue !== condition.value;
		case 'greaterThan':
			return Number(simulatedValue) > Number(condition.value);
		case 'lessThan':
			return Number(simulatedValue) < Number(condition.value);
		case 'includes': {
			const items = Array.isArray(simulatedValue) ? simulatedValue : undefined;

			return !items || items.includes(String(condition.value));
		}
		case 'notIncludes': {
			const items = Array.isArray(simulatedValue) ? simulatedValue : undefined;

			return !items || !items.includes(String(condition.value));
		}
	}
}

function conditionOperatorSymbol(
	operator: VisualCondition['operator'],
	t: TFunction
) {
	if (operator === 'includes') {
		return t('dialogs.passageEdit.visual.operatorIncludes');
	}

	if (operator === 'notIncludes') {
		return t('dialogs.passageEdit.visual.operatorNotIncludes');
	}

	const symbols = {
		equals: '=',
		notEquals: '≠',
		greaterThan: '>',
		lessThan: '<'
	} as const;

	return symbols[operator];
}

function conditionValueText(value: boolean | number | string) {
	return String(value);
}

function conditionInterpolation(
	t: TFunction,
	condition: VisualCondition,
	states: VisualStoryState[]
) {
	const state = states.find(item => item.id === condition.stateId);

	return {
		operator: conditionOperatorSymbol(condition.operator, t),
		state: state?.name ?? '?',
		value: conditionValueText(condition.value)
	};
}

/** Human-readable sentence for a condition, e.g. 'When Door is yes'. */
export function conditionSentenceText(
	t: TFunction,
	condition: VisualCondition,
	states: VisualStoryState[]
) {
	return t(
		'dialogs.passageEdit.visual.conditionSentence',
		conditionInterpolation(t, condition, states)
	);
}

/** Annotation shown on blocks hidden by the simulator. */
export function hiddenBecauseText(
	t: TFunction,
	condition: VisualCondition,
	states: VisualStoryState[]
) {
	return t(
		'dialogs.passageEdit.visual.hiddenBecause',
		conditionInterpolation(t, condition, states)
	);
}

function actionOperationWord(
	t: TFunction,
	operation: VisualStateAction['operation']
) {
	const keys = {
		clear: 'dialogs.passageEdit.visual.operationClear',
		decrease: 'dialogs.passageEdit.visual.operationDecrease',
		increase: 'dialogs.passageEdit.visual.operationIncrease',
		push: 'dialogs.passageEdit.visual.operationPush',
		remove: 'dialogs.passageEdit.visual.operationRemove',
		set: 'dialogs.passageEdit.visual.set'
	} as const;

	return t(keys[operation]);
}

/**
 * The starting value for a condition or action on a state. List states store
 * single text items in conditions and actions, so the empty list default of a
 * list state is replaced with an empty string.
 */
function stateValuePlaceholder(
	state?: VisualStoryState
): boolean | number | string {
	// Only list states hold array defaults, so the non-list branch is a
	// scalar; the cast reflects that invariant.
	return state?.type === 'list'
		? ''
		: (defaultValueForState(state) as boolean | number | string);
}

/** Human-readable sentence for a choice action, e.g. 'After choosing: Trust set to 3'. */
export function actionSentenceText(
	t: TFunction,
	action: VisualStateAction,
	states: VisualStoryState[]
) {
	const state = states.find(item => item.id === action.stateId);

	return t('dialogs.passageEdit.visual.actionSentence', {
		operation: actionOperationWord(t, action.operation),
		state: state?.name ?? '?',
		value: String(action.value)
	});
}

/**
 * Returns the index of the branch that would run for the given simulated
 * values: the first branch whose condition evaluates true, or the
 * conditionless 'else' branch when no earlier branch matches. Returns
 * undefined when the simulator is closed or no branch can be determined.
 */
function activeBranchIndex(
	branches: VisualBranch[],
	states: VisualStoryState[],
	simulated?: Record<string, SimulatedValue>
) {
	if (!simulated) {
		return undefined;
	}

	for (let index = 0; index < branches.length; index++) {
		const condition = branches[index].condition;

		if (!condition) {
			continue;
		}

		const state = states.find(item => item.id === condition.stateId);
		const value = simulated[condition.stateId] ?? state?.defaultValue ?? '';

		if (evaluateCondition(condition, state, value)) {
			return index;
		}
	}

	const elseIndex = branches.findIndex(item => !item.condition);

	return elseIndex >= 0 ? elseIndex : undefined;
}

/** True when a block with `condition` is hidden by the simulated values. */
function blockIsHidden(
	condition: VisualCondition | undefined,
	states: VisualStoryState[],
	simulated?: Record<string, SimulatedValue>
) {
	if (!simulated || !condition) {
		return false;
	}

	const state = states.find(item => item.id === condition.stateId);
	const value = simulated[condition.stateId] ?? state?.defaultValue ?? '';

	return !evaluateCondition(condition, state, value);
}

/**
 * Local editor state committed to the store through a debounced callback.
 * Every keystroke updates the local value immediately; a save is scheduled
 * ~300ms later. Blur and unmount flush any pending save so typed text is
 * never lost (e.g. when the dialog is closed with Escape).
 */
function useDebouncedSave<T>(
	propValue: T,
	commit: (value: T) => void,
	onPending: () => void,
	onFlushed: () => void,
	delay = 300
): [T, (value: T) => void, () => void] {
	const [value, setValue] = React.useState(propValue);
	const commitRef = React.useRef(commit);
	const onFlushedRef = React.useRef(onFlushed);
	const onPendingRef = React.useRef(onPending);
	const pendingRef = React.useRef(false);
	const timerRef = React.useRef<number | undefined>(undefined);
	const valueRef = React.useRef(value);

	// Keep the latest props available to scheduled callbacks.
	React.useEffect(() => {
		commitRef.current = commit;
		onFlushedRef.current = onFlushed;
		onPendingRef.current = onPending;
		valueRef.current = value;
	});

	// Follow external changes, but never overwrite text that is still
	// waiting for its debounced save.
	React.useEffect(() => {
		if (!pendingRef.current) {
			setValue(propValue);
		}
	}, [propValue]);

	const flush = React.useCallback(() => {
		if (!pendingRef.current) {
			return;
		}

		if (timerRef.current !== undefined) {
			window.clearTimeout(timerRef.current);
		}

		timerRef.current = undefined;
		pendingRef.current = false;
		commitRef.current(valueRef.current);
		onFlushedRef.current();
	}, []);

	const schedule = React.useCallback(
		(next: T) => {
			setValue(next);

			if (!pendingRef.current) {
				pendingRef.current = true;
				onPendingRef.current();
			}

			if (timerRef.current !== undefined) {
				window.clearTimeout(timerRef.current);
			}

			timerRef.current = window.setTimeout(() => {
				pendingRef.current = false;
				timerRef.current = undefined;
				commitRef.current(valueRef.current);
				onFlushedRef.current();
			}, delay);
		},
		[delay]
	);

	// Flush any pending save when the editor unmounts.
	React.useEffect(
		() => () => {
			flush();
		},
		[flush]
	);

	return [value, schedule, flush];
}

function ConditionEditor(props: {
	condition?: VisualCondition;
	onChange: (condition?: VisualCondition) => void;
	states: VisualStoryState[];
}) {
	const {condition, onChange, states} = props;
	const {t} = useTranslation();

	if (!condition) {
		return (
			<>
				<button
					disabled={states.length === 0}
					onClick={() => {
						const state = states[0];
						onChange({
							operator: 'equals',
							stateId: state.id,
							value: stateValuePlaceholder(state)
						});
					}}
					type="button"
				>
					{t('dialogs.passageEdit.visual.addCondition')}
				</button>
				{states.length === 0 && (
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.noStatesHint')}
					</p>
				)}
			</>
		);
	}

	const state = states.find(item => item.id === condition.stateId);

	return (
		<>
			<div className="condition-editor">
				<select
					aria-label={t('dialogs.passageEdit.visual.conditionState')}
					onChange={event => {
						const nextState = states.find(
							item => item.id === event.target.value
						);
						onChange({
							...condition,
							stateId: event.target.value,
							value: stateValuePlaceholder(nextState)
						});
					}}
					value={condition.stateId}
				>
					{states.map(item => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
				<select
					aria-label={t('dialogs.passageEdit.visual.conditionOperator')}
					onChange={event =>
						onChange({
							...condition,
							operator: event.target.value as VisualCondition['operator']
						})
					}
					value={condition.operator}
				>
					<option value="equals">=</option>
					<option value="notEquals">≠</option>
					{state?.type === 'number' && (
						<option value="greaterThan">&gt;</option>
					)}
					{state?.type === 'number' && (
						<option value="lessThan">&lt;</option>
					)}
					{state?.type === 'list' && (
						<option value="includes">
							{t('dialogs.passageEdit.visual.operatorIncludes')}
						</option>
					)}
					{state?.type === 'list' && (
						<option value="notIncludes">
							{t('dialogs.passageEdit.visual.operatorNotIncludes')}
						</option>
					)}
				</select>
				<StateValueInput
					label={t('dialogs.passageEdit.visual.conditionValue')}
					onChange={value => onChange({...condition, value})}
					state={state}
					value={condition.value}
				/>
				<button onClick={() => onChange(undefined)} type="button">×</button>
			</div>
			<p className="condition-summary">
				{conditionSentenceText(t, condition, states)}
			</p>
		</>
	);
}

interface TextBlockEditorProps {
	block: VisualTextBlock;
	disabled?: boolean;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualTextBlock>) => void;
	states: VisualStoryState[];
}

const TextBlockEditor: React.FC<TextBlockEditorProps> = props => {
	const {
		block,
		disabled,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		states
	} = props;
	const {t} = useTranslation();
	const [text, scheduleText, flushText] = useDebouncedSave(
		block.text,
		next => onUpdate({text: next}),
		onSavePending,
		onSaveFlushed
	);

	return (
		<div className="visual-passage-text">
			<textarea
				aria-label={t('dialogs.passageEdit.visual.body')}
				disabled={disabled}
				onBlur={flushText}
				onChange={event => scheduleText(event.target.value)}
				placeholder={t('dialogs.passageEdit.visual.bodyPlaceholder')}
				value={text}
			/>
			<div className="body-condition">
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={block.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
		</div>
	);
};

interface ChoiceEditorProps {
	choice: VisualChoiceBlock;
	disabled?: boolean;
	index: number;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualChoiceBlock>) => void;
	states: VisualStoryState[];
	story: Story;
}

const ChoiceEditor: React.FC<ChoiceEditorProps> = props => {
	const {
		choice,
		disabled,
		index,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		states,
		story
	} = props;
	const {t} = useTranslation();
	const [label, scheduleLabel, flushLabel] = useDebouncedSave(
		choice.label,
		next => onUpdate({label: next}),
		onSavePending,
		onSaveFlushed
	);

	return (
		<div className="visual-passage-choice">
			<div className="choice-heading">
				<strong>
					{t('dialogs.passageEdit.visual.choiceNumber', {count: index + 1})}
				</strong>
			</div>
			<label>
				<span>{t('dialogs.passageEdit.visual.choiceLabel')}</span>
				<input
					disabled={disabled}
					onBlur={flushLabel}
					onChange={event => scheduleLabel(event.target.value)}
					value={label}
				/>
			</label>
			<label>
				<span>{t('dialogs.passageEdit.visual.choiceTarget')}</span>
				<select
					disabled={disabled}
					onChange={event => {
						const value = event.target.value;

						// Back/return navigate instead of to a passage: they set
						// specialTarget and clear the passage target.
						if (value === 'back' || value === 'return') {
							onUpdate({specialTarget: value, targetPassageId: ''});
						} else {
							onUpdate({specialTarget: undefined, targetPassageId: value});
						}
					}}
					value={choice.specialTarget ?? choice.targetPassageId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseTarget')}
					</option>
					{story.passages.map(target => (
						<option key={target.id} value={target.id}>
							{target.name}
						</option>
					))}
					<option value="back">
						{t('dialogs.passageEdit.visual.targetBack')}
					</option>
					<option value="return">
						{t('dialogs.passageEdit.visual.targetReturn')}
					</option>
				</select>
			</label>
			<div>
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={choice.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
			<div className="choice-actions">
				<span>{t('dialogs.passageEdit.visual.actions')}</span>
				{(choice.actions ?? []).map((action, actionIndex) => {
					const state = states.find(item => item.id === action.stateId);
					return (
						<div className="action-row" key={actionIndex}>
							<select
								aria-label={t('dialogs.passageEdit.visual.actionState')}
								onChange={event => {
									const nextState = states.find(
										item => item.id === event.target.value
									);
									const actions = [...(choice.actions ?? [])];
									actions[actionIndex] = {
										...action,
										stateId: event.target.value,
										operation: 'set',
										value: stateValuePlaceholder(nextState)
									};
									onUpdate({actions});
								}}
								value={action.stateId}
							>
								{states.map(item => (
									<option key={item.id} value={item.id}>{item.name}</option>
								))}
							</select>
							<select
								aria-label={t('dialogs.passageEdit.visual.actionOperation')}
								onChange={event => {
									const actions = [...(choice.actions ?? [])];
									actions[actionIndex] = {
										...action,
										operation: event.target
											.value as VisualStateAction['operation']
									};
									onUpdate({actions});
								}}
								value={action.operation}
							>
								<option value="set">
									{t('dialogs.passageEdit.visual.set')}
								</option>
								{state?.type === 'number' && (
									<option value="increase">
										{t('dialogs.passageEdit.visual.operationIncrease')}
									</option>
								)}
								{state?.type === 'number' && (
									<option value="decrease">
										{t('dialogs.passageEdit.visual.operationDecrease')}
									</option>
								)}
								{state?.type === 'list' && (
									<option value="push">
										{t('dialogs.passageEdit.visual.operationPush')}
									</option>
								)}
								{state?.type === 'list' && (
									<option value="remove">
										{t('dialogs.passageEdit.visual.operationRemove')}
									</option>
								)}
								{state?.type === 'list' && (
									<option value="clear">
										{t('dialogs.passageEdit.visual.operationClear')}
									</option>
								)}
							</select>
							<StateValueInput
								label={t('dialogs.passageEdit.visual.actionValue')}
								onChange={value => {
									const actions = [...(choice.actions ?? [])];
									actions[actionIndex] = {...action, value};
									onUpdate({actions});
								}}
								state={state}
								value={action.value}
							/>
							<button
								onClick={() =>
									onUpdate({
										actions: (choice.actions ?? []).filter(
											(_, i) => i !== actionIndex
										)
									})
								}
								type="button"
							>×</button>
						</div>
					);
				})}
				<button
					disabled={states.length === 0}
					onClick={() => {
						const state = states[0];
						onUpdate({
							actions: [
								...(choice.actions ?? []),
								{
									stateId: state.id,
									operation: 'set',
									value: stateValuePlaceholder(state)
								}
							]
						});
					}}
					type="button"
				>{t('dialogs.passageEdit.visual.addAction')}</button>
				{states.length === 0 && (
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.noStatesHint')}
					</p>
				)}
			</div>
			{(choice.actions ?? []).length > 0 && (
				<ul className="choice-actions-summary">
					{(choice.actions ?? []).map((action, actionIndex) => (
						<li key={actionIndex}>
							{actionSentenceText(t, action, states)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

interface VariableEditorProps {
	block: VisualVariableBlock;
	disabled?: boolean;
	onUpdate: (props: Partial<VisualVariableBlock>) => void;
	states: VisualStoryState[];
}

const VariableEditor: React.FC<VariableEditorProps> = props => {
	const {block, disabled, onUpdate, states} = props;
	const {t} = useTranslation();

	return (
		<div className="visual-passage-variable">
			<label>
				<span>{t('dialogs.passageEdit.visual.variableState')}</span>
				<select
					disabled={disabled}
					onChange={event => onUpdate({stateId: event.target.value})}
					value={block.stateId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseState')}
					</option>
					{states.map(item => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
			</label>
			{block.stateId === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			<div>
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={block.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
		</div>
	);
};

interface IncludeEditorProps {
	block: VisualIncludeBlock;
	disabled?: boolean;
	onUpdate: (props: Partial<VisualIncludeBlock>) => void;
	states: VisualStoryState[];
	story: Story;
}

const IncludeEditor: React.FC<IncludeEditorProps> = props => {
	const {block, disabled, onUpdate, states, story} = props;
	const {t} = useTranslation();

	return (
		<div className="visual-passage-include">
			<label>
				<span>{t('dialogs.passageEdit.visual.includeTarget')}</span>
				<select
					disabled={disabled}
					onChange={event =>
						onUpdate({targetPassageId: event.target.value})
					}
					value={block.targetPassageId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseIncludeTarget')}
					</option>
					{story.passages.map(target => (
						<option key={target.id} value={target.id}>
							{target.name}
						</option>
					))}
				</select>
			</label>
			{block.targetPassageId === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			<div>
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={block.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
		</div>
	);
};

interface InteractionBlockEditorProps {
	block: VisualInteractionBlock;
	disabled?: boolean;
	onUpdate: (props: Partial<VisualInteractionBlock>) => void;
	states: VisualStoryState[];
}

const InteractionBlockEditor: React.FC<InteractionBlockEditorProps> = props => {
	const {block, disabled, onUpdate, states} = props;
	const {t} = useTranslation();

	return (
		<div className="visual-passage-interaction">
			<label>
				<span>{t('dialogs.passageEdit.visual.interactionLabel')}</span>
				<input
					aria-label={t('dialogs.passageEdit.visual.interactionLabel')}
					disabled={disabled}
					onChange={event => onUpdate({label: event.target.value})}
					value={block.label}
				/>
			</label>
			<label>
				<span>{t('dialogs.passageEdit.visual.interactionOperation')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.interactionOperation')}
					disabled={disabled}
					onChange={event =>
						onUpdate({
							operation: event.target
								.value as VisualInteractionBlock['operation']
						})
					}
					value={block.operation}
				>
					<option value="reveal">
						{t('dialogs.passageEdit.visual.operationReveal')}
					</option>
					<option value="append">
						{t('dialogs.passageEdit.visual.operationAppend')}
					</option>
					<option value="remove">
						{t('dialogs.passageEdit.visual.interactionOperationRemove')}
					</option>
				</select>
			</label>
			<label>
				<span>{t('dialogs.passageEdit.visual.interactionContent')}</span>
				<textarea
					aria-label={t('dialogs.passageEdit.visual.interactionContent')}
					disabled={disabled}
					onChange={event => onUpdate({content: event.target.value})}
					value={block.content}
				/>
			</label>
			{block.label === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			<div>
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={block.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
		</div>
	);
};

interface BranchEditorProps {
	branch: VisualBranchBlock;
	depth: number;
	disabled?: boolean;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualBranchBlock>) => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
}

/**
 * Ensures a branch block stays valid: the last branch must be the
 * conditionless else branch. If it has a condition, append a fresh else.
 */
function normalizeBranches(branches: VisualBranch[]): VisualBranch[] {
	const result = [...branches];

	if (result[result.length - 1]?.condition) {
		result.push({blocks: [], id: uuid()});
	}

	return result;
}

const BranchEditor: React.FC<BranchEditorProps> = props => {
	const {
		branch,
		depth,
		disabled,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		simulated,
		states,
		story
	} = props;
	const {t} = useTranslation();

	function updateBranch(index: number, props: Partial<VisualBranch>) {
		const isLast = index === branch.branches.length - 1;
		const branches = branch.branches.map((item, i) => {
			if (i !== index) {
				return item;
			}

			// Only the last branch may be the conditionless else branch.
			if (!isLast && 'condition' in props && props.condition === undefined) {
				return {...item, ...props, condition: item.condition};
			}

			return {...item, ...props};
		});

		onUpdate({branches: normalizeBranches(branches)});
	}

	function addBranch() {
		const branches = [...branch.branches];
		const elseIndex = branches.findIndex(item => !item.condition);

		// Keep the else branch last: insert before it if one exists.
		if (elseIndex >= 0) {
			branches.splice(elseIndex, 0, {blocks: [], id: uuid()});
		} else {
			branches.push({blocks: [], id: uuid()});
		}

		onUpdate({branches: normalizeBranches(branches)});
	}

	function removeBranch(index: number) {
		if (branch.branches.length <= 2) {
			return;
		}

		onUpdate({
			branches: normalizeBranches(
				branch.branches.filter((_, i) => i !== index)
			)
		});
	}

	const active = activeBranchIndex(branch.branches, states, simulated);

	return (
		<div className="visual-passage-choice visual-passage-branch">
			{branch.branches.map((item, index) => {
				const inactive = active !== undefined && active !== index;

				return (
					<div
						className={inactive ? 'branch is-inactive' : 'branch'}
						key={item.id}
					>
						<div className="branch-condition">
							{item.condition ? (
								<>
									<span>{t('dialogs.passageEdit.visual.condition')}</span>
									<ConditionEditor
										condition={item.condition}
										onChange={condition =>
											updateBranch(index, {condition})
										}
										states={states}
									/>
								</>
							) : (
								<span className="else-label">
									{t('dialogs.passageEdit.visual.else')}
								</span>
							)}
							{inactive && (
								<span className="hidden-badge">
									{item.condition
										? hiddenBecauseText(t, item.condition, states)
										: t('dialogs.passageEdit.visual.hidden')}
								</span>
							)}
							<button
								disabled={disabled || branch.branches.length <= 2}
								onClick={() => removeBranch(index)}
								type="button"
							>
								×
							</button>
						</div>
						<BlockList
							blocks={item.blocks}
							depth={depth + 1}
							disabled={disabled}
							onChange={blocks => updateBranch(index, {blocks})}
							onSaveFlushed={onSaveFlushed}
							onSavePending={onSavePending}
							simulated={simulated}
							states={states}
							story={story}
						/>
					</div>
				);
			})}
			<button disabled={disabled} onClick={addBranch} type="button">
				Add branch
			</button>
		</div>
	);
};

interface BlockShellProps {
	canMoveDown: boolean;
	canMoveUp: boolean;
	children: React.ReactNode;
	condition?: VisualCondition;
	depth: number;
	disabled?: boolean;
	hidden: boolean;
	icon: React.ComponentType;
	kindLabel: string;
	onDelete: () => void;
	onMoveDown: () => void;
	onMoveUp: () => void;
	states: VisualStoryState[];
}

/**
 * Shared chrome around a visual block: the header with the kind icon and
 * label, the condition gate, and the move/delete toolbar. Block kinds only
 * supply their body editor; the shell keeps the layout identical for every
 * kind. The depth prop prepares for a later visual tree overhaul.
 */
const BlockShell: React.FC<BlockShellProps> = props => {
	const {
		canMoveDown,
		canMoveUp,
		children,
		condition,
		depth,
		disabled,
		hidden,
		icon,
		kindLabel,
		onDelete,
		onMoveDown,
		onMoveUp,
		states
	} = props;
	const {t} = useTranslation();
	const Icon = icon;

	return (
		<div className="visual-block" data-depth={depth}>
			<div className="block-header">
				<div className="block-gate">
					<Icon />
					<span className="block-kind">{kindLabel}</span>
					{condition && !hidden && (
						<span className="block-condition-summary">
							{conditionSentenceText(t, condition, states)}
						</span>
					)}
					{hidden && condition && (
						<span className="hidden-badge">
							{hiddenBecauseText(t, condition, states)}
						</span>
					)}
				</div>
				<div className="block-toolbar">
					<IconButton
						disabled={disabled || !canMoveUp}
						icon={<IconArrowUp />}
						iconOnly
						label="Move up"
						onClick={onMoveUp}
					/>
					<IconButton
						disabled={disabled || !canMoveDown}
						icon={<IconArrowDown />}
						iconOnly
						label="Move down"
						onClick={onMoveDown}
					/>
					<IconButton
						disabled={disabled}
						icon={<IconTrash />}
						iconOnly
						label="Delete block"
						onClick={onDelete}
						variant="danger"
					/>
				</div>
			</div>
			<div
				className={
					hidden ? 'visual-block-body is-hidden' : 'visual-block-body'
				}
			>
				{children}
			</div>
		</div>
	);
};

interface BlockListProps {
	blocks: VisualBlock[];
	depth?: number;
	disabled?: boolean;
	onChange: (blocks: VisualBlock[]) => void;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
}

const BlockList: React.FC<BlockListProps> = props => {
	const {
		blocks,
		depth = 0,
		disabled,
		onChange,
		onSaveFlushed,
		onSavePending,
		simulated,
		states,
		story
	} = props;
	const {t} = useTranslation();

	function updateBlock(blockId: string, next: VisualBlock) {
		onChange(blocks.map(block => (block.id === blockId ? next : block)));
	}

	function moveBlock(index: number, delta: number) {
		const target = index + delta;

		if (target < 0 || target >= blocks.length) {
			return;
		}

		const next = [...blocks];

		[next[index], next[target]] = [next[target], next[index]];
		onChange(next);
	}

	function deleteBlock(index: number) {
		onChange(blocks.filter((_, i) => i !== index));
	}

	function addTextBlock() {
		onChange([...blocks, {id: uuid(), kind: 'text', text: ''}]);
	}

	function addChoiceBlock() {
		onChange([
			...blocks,
			{
				actions: [],
				id: uuid(),
				kind: 'choice',
				label: '',
				targetPassageId: ''
			}
		]);
	}

	function addBranchBlock() {
		onChange([
			...blocks,
			{
				branches: [
					{blocks: [], id: uuid()},
					{blocks: [], id: uuid()}
				],
				id: uuid(),
				kind: 'branch'
			}
		]);
	}

	function addVariableBlock() {
		onChange([...blocks, {id: uuid(), kind: 'variable', stateId: ''}]);
	}

	function addIncludeBlock() {
		onChange([
			...blocks,
			{id: uuid(), kind: 'include', targetPassageId: ''}
		]);
	}

	function addInteractionBlock() {
		onChange([
			...blocks,
			{
				content: '',
				id: uuid(),
				kind: 'interaction',
				label: '',
				operation: 'reveal'
			}
		]);
	}

	return (
		<div className="visual-block-list">
			{blocks.map((block, index) => {
				const choiceIndex = blocks
					.slice(0, index)
					.filter(item => item.kind === 'choice').length;
				const meta = blockKindMeta[block.kind];
				const condition = 'condition' in block ? block.condition : undefined;
				const hidden = blockIsHidden(condition, states, simulated);

				return (
					<BlockShell
						canMoveDown={index < blocks.length - 1}
						canMoveUp={index > 0}
						condition={condition}
						depth={depth}
						disabled={disabled}
						hidden={hidden}
						icon={meta.icon}
						key={block.id}
						kindLabel={t(meta.labelKey)}
						onDelete={() => deleteBlock(index)}
						onMoveDown={() => moveBlock(index, 1)}
						onMoveUp={() => moveBlock(index, -1)}
						states={states}
					>
						{block.kind === 'text' && (
							<TextBlockEditor
								block={block}
								disabled={disabled}
								onSaveFlushed={onSaveFlushed}
								onSavePending={onSavePending}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
						{block.kind === 'choice' && (
							<ChoiceEditor
								choice={block}
								disabled={disabled}
								index={choiceIndex}
								onSaveFlushed={onSaveFlushed}
								onSavePending={onSavePending}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
								story={story}
							/>
						)}
						{block.kind === 'branch' && (
							<BranchEditor
								branch={block}
								depth={depth}
								disabled={disabled}
								onSaveFlushed={onSaveFlushed}
								onSavePending={onSavePending}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								simulated={simulated}
								states={states}
								story={story}
							/>
						)}
						{block.kind === 'variable' && (
							<VariableEditor
								block={block}
								disabled={disabled}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
						{block.kind === 'include' && (
							<IncludeEditor
								block={block}
								disabled={disabled}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
								story={story}
							/>
						)}
						{block.kind === 'interaction' && (
							<InteractionBlockEditor
								block={block}
								disabled={disabled}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
					</BlockShell>
				);
			})}
			<div className="block-add-buttons">
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label="Add text block"
					onClick={addTextBlock}
					variant="create"
				/>
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addChoice')}
					onClick={addChoiceBlock}
					variant="create"
				/>
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label="Add branch"
					onClick={addBranchBlock}
					variant="create"
				/>
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addVariableBlock')}
					onClick={addVariableBlock}
					variant="create"
				/>
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addIncludeBlock')}
					onClick={addIncludeBlock}
					variant="create"
				/>
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addInteractionBlock')}
					onClick={addInteractionBlock}
					variant="create"
				/>
			</div>
		</div>
	);
};

export interface PassageVisualEditorProps {
	disabled?: boolean;
	passage: Passage & {visual: VisualPassageContent};
	story: Story;
}

export const PassageVisualEditor: React.FC<PassageVisualEditorProps> = props => {
	const {disabled, passage, story} = props;
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const [pendingSaves, setPendingSaves] = React.useState(0);
	const [showSource, setShowSource] = React.useState(false);
	const [simulatedValues, setSimulatedValues] = React.useState<
		Record<string, SimulatedValue>
	>({});
	const [simulatorOpen, setSimulatorOpen] = React.useState(false);
	const content = React.useMemo(
		() => migrateVisualContent(passage.visual),
		[passage.visual]
	);
	const states = story.visual?.states ?? [];

	// Reset simulated values whenever the story's state list changes.
	const stateKey = states
		.map(state => `${state.id}:${state.type}:${String(state.defaultValue)}`)
		.join('\u0000');

	React.useEffect(() => {
		const next: Record<string, SimulatedValue> = {};

		states.forEach(state => {
			next[state.id] = state.defaultValue;
		});
		setSimulatedValues(next);
	}, [stateKey]);

	const onSavePending = React.useCallback(
		() => setPendingSaves(count => count + 1),
		[]
	);
	const onSaveFlushed = React.useCallback(
		() => setPendingSaves(count => Math.max(0, count - 1)),
		[]
	);

	const updateVisual = React.useCallback(
		(
			content: VisualPassageContentV2,
			description = 'undoChange.editPassage'
		) => {
			dispatch(
				updatePassage(story, passage, {
					text: compileVisualPassage(content, story, passage.id),
					visual: content
				}),
				description
			);
		},
		[dispatch, passage, story]
	);

	const updateBlocks = React.useCallback(
		(blocks: VisualBlock[]) => updateVisual({blocks, version: 2}),
		[updateVisual]
	);

	const handleSwitchToSource = React.useCallback(() => {
		if (!window.confirm(t('dialogs.passageEdit.visual.switchToSourceConfirm'))) {
			return;
		}

		// Compile the current visual content into source and drop the visual
		// data so the passage editor switches to (one-way) source editing.
		dispatch(
			updatePassage(story, passage, {
				text: compileVisualPassage(content, story, passage.id),
				visual: undefined
			})
		);
	}, [content, dispatch, passage, story, t]);

	// The simulation view is only applied while the drawer is open.
	const simulated = simulatorOpen ? simulatedValues : undefined;

	return (
		<div className="passage-visual-editor">
			<div className="visual-editor-header">
				<span className="save-indicator">
					{pendingSaves > 0
						? t('dialogs.passageEdit.visual.saving')
						: t('dialogs.passageEdit.visual.saved')}
				</span>
			</div>
			<section className="visual-passage-blocks">
				<div className="section-heading">
					<h3>Blocks</h3>
				</div>
				<BlockList
					blocks={content.blocks}
					disabled={disabled}
					onChange={updateBlocks}
					onSaveFlushed={onSaveFlushed}
					onSavePending={onSavePending}
					simulated={simulated}
					states={states}
					story={story}
				/>
			</section>

			<section className="generated-source">
				<IconButton
					icon={<IconCode />}
					label={
						showSource
							? t('dialogs.passageEdit.visual.hideSource')
							: t('dialogs.passageEdit.visual.showSource')
					}
					onClick={() => setShowSource(!showSource)}
				/>
				<IconButton
					icon={<IconSourceCode />}
					label={t('dialogs.passageEdit.visual.switchToSource')}
					onClick={handleSwitchToSource}
				/>
				{showSource && (
					<pre>{compileVisualPassage(content, story, passage.id)}</pre>
				)}
			</section>

			<section className="simulator-section">
				<button
					aria-expanded={simulatorOpen}
					onClick={() => setSimulatorOpen(open => !open)}
					type="button"
				>
					{t('dialogs.passageEdit.visual.simulatorToggle')}
				</button>
				{simulatorOpen && (
					<div className="simulator-drawer">
						{states.length === 0 ? (
							<p className="empty-state">
								{t('dialogs.passageEdit.visual.noStatesHint')}
							</p>
						) : (
							<>
								<h4>{t('dialogs.passageEdit.visual.simulator')}</h4>
								{states.map(state => {
									const value =
										simulatedValues[state.id] ?? state.defaultValue;

									return (
										<div className="simulator-row" key={state.id}>
											<span className="simulator-state-name">
												{state.name}
											</span>
											{state.type === 'list' ? (
												<input
													aria-label={t(
														'dialogs.passageEdit.visual.simulatorValue',
														{name: state.name}
													)}
													onChange={event => {
														const raw = event.target.value;
														const items =
															raw === ''
																? []
																: raw
																		.split(',')
																		.map(item => item.trim())
																		.filter(item => item !== '');
														setSimulatedValues(prev => ({
															...prev,
															[state.id]: items
														}));
													}}
													value={
														Array.isArray(value)
															? value.join(', ')
															: ''
													}
												/>
											) : (
												<StateValueInput
													label={t(
														'dialogs.passageEdit.visual.simulatorValue',
														{name: state.name}
													)}
													onChange={value =>
														setSimulatedValues(prev => ({
															...prev,
															[state.id]: value
														}))
													}
													state={state}
													value={value as boolean | number | string}
												/>
											)}
										</div>
									);
								})}
							</>
						)}
					</div>
				)}
			</section>
		</div>
	);
};
