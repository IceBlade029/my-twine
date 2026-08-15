import {v4 as uuid} from '@lukeed/uuid';
import {IconCode, IconPlus, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	Passage,
	Story,
	VisualCondition,
	VisualPassageContentV1,
	VisualStateAction,
	VisualStoryState,
	updateStory,
	updatePassage
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {compileVisualPassage} from '../../util/visual-passage';
import './passage-visual-editor.css';

function defaultValueForState(state?: VisualStoryState) {
	if (state?.type === 'boolean') {
		return false;
	}
	if (state?.type === 'number') {
		return 0;
	}
	return '';
}

function StateValueInput(props: {
	label?: string;
	onChange: (value: boolean | number | string) => void;
	state?: VisualStoryState;
	value: boolean | number | string;
}) {
	const {label, onChange, state, value} = props;

	if (state?.type === 'boolean') {
		return (
			<select
				aria-label={label}
				onChange={event => onChange(event.target.value === 'true')}
				value={String(value)}
			>
				<option value="false">false</option>
				<option value="true">true</option>
			</select>
		);
	}

	return (
		<input
			aria-label={label}
			onChange={event =>
				onChange(
					state?.type === 'number'
						? Number(event.target.value)
						: event.target.value
				)
			}
			type={state?.type === 'number' ? 'number' : 'text'}
			value={String(value)}
		/>
	);
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
			<button
				disabled={states.length === 0}
				onClick={() => {
					const state = states[0];
					onChange({
						operator: 'equals',
						stateId: state.id,
						value: defaultValueForState(state)
					});
				}}
				type="button"
			>
				{t('dialogs.passageEdit.visual.addCondition')}
			</button>
		);
	}

	const state = states.find(item => item.id === condition.stateId);

	return (
		<div className="condition-editor">
			<select
				aria-label={t('dialogs.passageEdit.visual.conditionState')}
				onChange={event => {
					const nextState = states.find(item => item.id === event.target.value);
					onChange({
						...condition,
						stateId: event.target.value,
						value: defaultValueForState(nextState)
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
					onChange({...condition, operator: event.target.value as VisualCondition['operator']})
				}
				value={condition.operator}
			>
				<option value="equals">=</option>
				<option value="notEquals">≠</option>
				{state?.type === 'number' && <option value="greaterThan">&gt;</option>}
				{state?.type === 'number' && <option value="lessThan">&lt;</option>}
			</select>
			<StateValueInput
				label={t('dialogs.passageEdit.visual.conditionValue')}
				onChange={value => onChange({...condition, value})}
				state={state}
				value={condition.value}
			/>
			<button onClick={() => onChange(undefined)} type="button">×</button>
		</div>
	);
}

function StateManager(props: {story: Story}) {
	const {story} = props;
	const {dispatch, stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const states = story.visual?.states ?? [];

	function updateStates(nextStates: VisualStoryState[]) {
		const stateIds = new Set(nextStates.map(state => state.id));
		const nextStory: Story = {
			...story,
			visual: {states: nextStates, version: 1}
		};
		nextStory.passages = story.passages.map(passage => {
			if (!passage.visual) {
				return passage;
			}

			const visual: VisualPassageContentV1 = {
				...passage.visual,
				bodyCondition:
					passage.visual.bodyCondition &&
					stateIds.has(passage.visual.bodyCondition.stateId)
						? passage.visual.bodyCondition
						: undefined,
				choices: passage.visual.choices.map(choice => ({
					...choice,
					actions: (choice.actions ?? []).filter(action =>
						stateIds.has(action.stateId)
					),
					condition:
						choice.condition && stateIds.has(choice.condition.stateId)
							? choice.condition
							: undefined
				}))
			};

			return {
				...passage,
				text: compileVisualPassage(visual, nextStory),
				visual
			};
		});
		dispatch(
			updateStory(stories, story, {
				passages: nextStory.passages,
				visual: nextStory.visual
			}),
			'undoChange.editStoryStates'
		);
	}

	return (
		<section className="visual-story-states">
			<div className="section-heading">
				<h3>{t('dialogs.passageEdit.visual.states')}</h3>
				<IconButton
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addState')}
					onClick={() =>
						updateStates([
							...states,
							{id: uuid(), name: t('dialogs.passageEdit.visual.newState'), type: 'boolean', defaultValue: false}
						])
					}
					variant="create"
				/>
			</div>
			{states.map(state => (
				<div className="state-row" key={state.id}>
					<input
						aria-label={t('dialogs.passageEdit.visual.stateName')}
						onChange={event => updateStates(states.map(item => item.id === state.id ? {...item, name: event.target.value} : item))}
						value={state.name}
					/>
					<select
						aria-label={t('dialogs.passageEdit.visual.stateType')}
						onChange={event => {
							const type = event.target.value as VisualStoryState['type'];
							updateStates(states.map(item => item.id === state.id ? {...item, type, defaultValue: defaultValueForState({...item, type})} : item));
						}}
						value={state.type}
					>
						<option value="boolean">{t('dialogs.passageEdit.visual.boolean')}</option>
						<option value="number">{t('dialogs.passageEdit.visual.number')}</option>
						<option value="text">{t('dialogs.passageEdit.visual.text')}</option>
					</select>
					<StateValueInput label={t('dialogs.passageEdit.visual.defaultValue')} state={state} value={state.defaultValue} onChange={defaultValue => updateStates(states.map(item => item.id === state.id ? {...item, defaultValue} : item))} />
					<button onClick={() => updateStates(states.filter(item => item.id !== state.id))} type="button">×</button>
				</div>
			))}
		</section>
	);
}

interface ChoiceEditorProps {
	choice: VisualPassageContentV1['choices'][number];
	disabled?: boolean;
	index: number;
	onDelete: () => void;
	onUpdate: (
		props: Partial<VisualPassageContentV1['choices'][number]>
	) => void;
	states: VisualStoryState[];
	story: Story;
}

const ChoiceEditor: React.FC<ChoiceEditorProps> = props => {
	const {choice, disabled, index, onDelete, onUpdate, states, story} = props;
	const [label, setLabel] = React.useState(choice.label);
	const {t} = useTranslation();

	React.useEffect(() => setLabel(choice.label), [choice.label]);

	return (
		<div className="visual-passage-choice">
			<div className="choice-heading">
				<strong>
					{t('dialogs.passageEdit.visual.choiceNumber', {count: index + 1})}
				</strong>
				<IconButton
					disabled={disabled}
					icon={<IconTrash />}
					iconOnly
					label={t('dialogs.passageEdit.visual.deleteChoice')}
					onClick={onDelete}
					variant="danger"
				/>
			</div>
			<label>
				<span>{t('dialogs.passageEdit.visual.choiceLabel')}</span>
				<input
					disabled={disabled}
					onBlur={() => label !== choice.label && onUpdate({label})}
					onChange={event => setLabel(event.target.value)}
					value={label}
				/>
			</label>
			<label>
				<span>{t('dialogs.passageEdit.visual.choiceTarget')}</span>
				<select
					disabled={disabled}
					onChange={event => onUpdate({targetPassageId: event.target.value})}
					value={choice.targetPassageId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseTarget')}
					</option>
					{story.passages.map(target => (
						<option key={target.id} value={target.id}>
							{target.name}
						</option>
					))}
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
									const nextState = states.find(item => item.id === event.target.value);
									const actions = [...(choice.actions ?? [])];
									actions[actionIndex] = {...action, stateId: event.target.value, operation: 'set', value: defaultValueForState(nextState)};
									onUpdate({actions});
								}}
								value={action.stateId}
							>
								{states.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
							</select>
							<select
								aria-label={t('dialogs.passageEdit.visual.actionOperation')}
								onChange={event => {
									const actions = [...(choice.actions ?? [])];
									actions[actionIndex] = {...action, operation: event.target.value as VisualStateAction['operation']};
									onUpdate({actions});
								}}
								value={action.operation}
							>
								<option value="set">{t('dialogs.passageEdit.visual.set')}</option>
								{state?.type === 'number' && <option value="increase">+</option>}
								{state?.type === 'number' && <option value="decrease">−</option>}
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
							<button onClick={() => onUpdate({actions: (choice.actions ?? []).filter((_, i) => i !== actionIndex)})} type="button">×</button>
						</div>
					);
				})}
				<button
					disabled={states.length === 0}
					onClick={() => {
						const state = states[0];
						onUpdate({actions: [...(choice.actions ?? []), {stateId: state.id, operation: 'set', value: defaultValueForState(state)}]});
					}}
					type="button"
				>{t('dialogs.passageEdit.visual.addAction')}</button>
			</div>
		</div>
	);
};

export interface PassageVisualEditorProps {
	disabled?: boolean;
	passage: Passage & {visual: VisualPassageContentV1};
	story: Story;
}

export const PassageVisualEditor: React.FC<PassageVisualEditorProps> = props => {
	const {disabled, passage, story} = props;
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const [body, setBody] = React.useState(passage.visual.body);
	const [showSource, setShowSource] = React.useState(false);
	const states = story.visual?.states ?? [];

	React.useEffect(() => setBody(passage.visual.body), [passage.visual.body]);

	const updateVisual = React.useCallback(
		(content: VisualPassageContentV1, description = 'undoChange.editPassage') => {
			dispatch(
				updatePassage(story, passage, {
					text: compileVisualPassage(content, story),
					visual: content
				}),
				description
			);
		},
		[dispatch, passage, story]
	);

	function commitBody() {
		if (body !== passage.visual.body) {
			updateVisual({...passage.visual, body});
		}
	}

	function addChoice() {
		updateVisual({
			...passage.visual,
			choices: [
				...passage.visual.choices,
				{id: uuid(), label: '', targetPassageId: '', actions: []}
			]
		});
	}

	function updateChoice(
		choiceId: string,
		props: Partial<VisualPassageContentV1['choices'][number]>
	) {
		updateVisual({
			...passage.visual,
			choices: passage.visual.choices.map(choice =>
				choice.id === choiceId ? {...choice, ...props} : choice
			)
		});
	}

	function deleteChoice(choiceId: string) {
		updateVisual({
			...passage.visual,
			choices: passage.visual.choices.filter(choice => choice.id !== choiceId)
		});
	}

	return (
		<div className="passage-visual-editor">
			<StateManager story={story} />
			<section>
				<label htmlFor={`visual-passage-body-${passage.id}`}>
					{t('dialogs.passageEdit.visual.body')}
				</label>
				<textarea
					disabled={disabled}
					id={`visual-passage-body-${passage.id}`}
					onBlur={commitBody}
					onChange={event => setBody(event.target.value)}
					placeholder={t('dialogs.passageEdit.visual.bodyPlaceholder')}
					value={body}
				/>
				<div className="body-condition">
					<span>{t('dialogs.passageEdit.visual.condition')}</span>
					<ConditionEditor
						condition={passage.visual.bodyCondition}
						onChange={bodyCondition => updateVisual({...passage.visual, bodyCondition})}
						states={states}
					/>
				</div>
			</section>

			<section className="visual-passage-choices">
				<div className="section-heading">
					<h3>{t('dialogs.passageEdit.visual.choices')}</h3>
					<IconButton
						disabled={disabled}
						icon={<IconPlus />}
						label={t('dialogs.passageEdit.visual.addChoice')}
						onClick={addChoice}
						variant="create"
					/>
				</div>

				{passage.visual.choices.length === 0 && (
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.noChoices')}
					</p>
				)}

				{passage.visual.choices.map((choice, index) => (
					<ChoiceEditor
						choice={choice}
						disabled={disabled}
						index={index}
						key={choice.id}
						onDelete={() => deleteChoice(choice.id)}
						onUpdate={props => updateChoice(choice.id, props)}
						states={states}
						story={story}
					/>
				))}
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
				{showSource && <pre>{compileVisualPassage(passage.visual, story)}</pre>}
			</section>
		</div>
	);
};
