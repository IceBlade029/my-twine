import {v4 as uuid} from '@lukeed/uuid';
import {IconPlus} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	Story,
	VisualBlock,
	VisualCondition,
	VisualStateAction,
	VisualStoryState,
	updateStory
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	compileVisualPassage,
	migrateVisualContent
} from '../../util/visual-passage';
import './story-states-manager.css';

export function defaultValueForState(
	state?: VisualStoryState
): boolean | number | string | string[] {
	if (state?.type === 'boolean') {
		return false;
	}
	if (state?.type === 'number') {
		return 0;
	}
	if (state?.type === 'list') {
		return [];
	}
	return '';
}

export function StateValueInput(props: {
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

	// Boolean handled above; anything else (text, number, list) uses the
	// plain input. List values are single items, so they stay strings: only
	// number states get number coercion.
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

/**
 * Edits the string[] default value of a list state: one text input per item
 * with a remove button, plus an 'add item' button.
 */
export function ListValueInput(props: {
	items: string[];
	onChange: (items: string[]) => void;
}) {
	const {items, onChange} = props;
	const {t} = useTranslation();

	return (
		<div className="list-value-input">
			{items.map((item, index) => (
				<div className="list-item-row" key={index}>
					<input
						aria-label={t('dialogs.passageEdit.visual.listItem')}
						onChange={event => {
							const next = [...items];

							next[index] = event.target.value;
							onChange(next);
						}}
						value={item}
					/>
					<button
						aria-label={t('dialogs.passageEdit.visual.removeListItem')}
						onClick={() =>
							onChange(items.filter((_, i) => i !== index))
						}
						type="button"
					>×</button>
				</div>
			))}
			<button onClick={() => onChange([...items, ''])} type="button">
				{t('dialogs.passageEdit.visual.addListItem')}
			</button>
		</div>
	);
}

/** True when a condition's operator makes sense for the state's type. */
export function isConditionCompatible(
	condition: VisualCondition,
	state?: VisualStoryState
) {
	if (!state) {
		return false;
	}

	if (condition.operator === 'greaterThan' || condition.operator === 'lessThan') {
		return state.type === 'number';
	}

	if (condition.operator === 'includes' || condition.operator === 'notIncludes') {
		return state.type === 'list';
	}

	return true; // equals / notEquals work for every type
}

/** True when an action's operation makes sense for the state's type. */
export function isActionCompatible(
	action: VisualStateAction,
	state?: VisualStoryState
) {
	if (!state) {
		return false;
	}

	if (action.operation === 'increase' || action.operation === 'decrease') {
		return state.type === 'number';
	}

	if (
		action.operation === 'push' ||
		action.operation === 'remove' ||
		action.operation === 'clear'
	) {
		return state.type === 'list';
	}

	return true; // set works for every type
}

/**
 * Removes references to story states that no longer exist from a block list,
 * recursing through branches. References whose operator/operation is
 * incompatible with the state's current type are removed as well.
 */
function stripStateReferences(
	blocks: VisualBlock[],
	statesById: Map<string, VisualStoryState>
): VisualBlock[] {
	return blocks.map(block => {
		if (block.kind === 'text') {
			return {
				...block,
				condition:
					block.condition &&
					isConditionCompatible(
						block.condition,
						statesById.get(block.condition.stateId)
					)
						? block.condition
						: undefined
			};
		}

		if (block.kind === 'choice') {
			return {
				...block,
				actions: block.actions.filter(action =>
					isActionCompatible(action, statesById.get(action.stateId))
				),
				condition:
					block.condition &&
					isConditionCompatible(
						block.condition,
						statesById.get(block.condition.stateId)
					)
						? block.condition
						: undefined
			};
		}

		// A variable block whose state was deleted becomes incomplete; its
		// condition is stripped like any other block's.
		if (block.kind === 'variable') {
			return {
				...block,
				stateId: statesById.has(block.stateId) ? block.stateId : '',
				condition:
					block.condition &&
					isConditionCompatible(
						block.condition,
						statesById.get(block.condition.stateId)
					)
						? block.condition
						: undefined
			};
		}

		if (block.kind === 'include') {
			return {
				...block,
				condition:
					block.condition &&
					isConditionCompatible(
						block.condition,
						statesById.get(block.condition.stateId)
					)
						? block.condition
						: undefined
			};
		}

		return {
			...block,
			branches: block.branches.map(branch => ({
				...branch,
				condition:
					branch.condition &&
					isConditionCompatible(
						branch.condition,
						statesById.get(branch.condition.stateId)
					)
						? branch.condition
						: undefined,
				blocks: stripStateReferences(branch.blocks, statesById)
			}))
		};
	});
}

export interface StoryStatesManagerProps {
	story: Story;
}

export const StoryStatesManager: React.FC<StoryStatesManagerProps> = props => {
	const {story} = props;
	const {dispatch, stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const states = story.visual?.states ?? [];

	function updateStates(nextStates: VisualStoryState[]) {
		const statesById = new Map(
			nextStates.map(state => [state.id, state] as const)
		);
		const nextStory: Story = {
			...story,
			visual: {states: nextStates, version: 1}
		};
		nextStory.passages = story.passages.map(passage => {
			if (!passage.visual) {
				return passage;
			}

			const visual = migrateVisualContent(passage.visual);

			visual.blocks = stripStateReferences(visual.blocks, statesById);

			return {
				...passage,
				text: compileVisualPassage(visual, nextStory, passage.id),
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
						<option value="list">{t('dialogs.passageEdit.visual.list')}</option>
					</select>
					{state.type === 'list' ? (
						<ListValueInput
							items={state.defaultValue as string[]}
							onChange={defaultValue => updateStates(states.map(item => item.id === state.id ? {...item, defaultValue} : item))}
						/>
					) : (
						<StateValueInput label={t('dialogs.passageEdit.visual.defaultValue')} state={state} value={state.defaultValue as boolean | number | string} onChange={defaultValue => updateStates(states.map(item => item.id === state.id ? {...item, defaultValue} : item))} />
					)}
					<button onClick={() => updateStates(states.filter(item => item.id !== state.id))} type="button">×</button>
				</div>
			))}
		</section>
	);
};
