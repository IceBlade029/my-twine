import {v4 as uuid} from '@lukeed/uuid';
import {IconPlus} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	Story,
	VisualBlock,
	VisualStoryState,
	updateStory
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	compileVisualPassage,
	migrateVisualContent
} from '../../util/visual-passage';
import './story-states-manager.css';

export function defaultValueForState(state?: VisualStoryState) {
	if (state?.type === 'boolean') {
		return false;
	}
	if (state?.type === 'number') {
		return 0;
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
 * Removes references to story states that no longer exist from a block list,
 * recursing through branches.
 */
function stripStateReferences(
	blocks: VisualBlock[],
	stateIds: Set<string>
): VisualBlock[] {
	return blocks.map(block => {
		if (block.kind === 'text') {
			return {
				...block,
				condition:
					block.condition && stateIds.has(block.condition.stateId)
						? block.condition
						: undefined
			};
		}

		if (block.kind === 'choice') {
			return {
				...block,
				actions: block.actions.filter(action =>
					stateIds.has(action.stateId)
				),
				condition:
					block.condition && stateIds.has(block.condition.stateId)
						? block.condition
						: undefined
			};
		}

		return {
			...block,
			branches: block.branches.map(branch => ({
				...branch,
				condition:
					branch.condition && stateIds.has(branch.condition.stateId)
						? branch.condition
						: undefined,
				blocks: stripStateReferences(branch.blocks, stateIds)
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
		const stateIds = new Set(nextStates.map(state => state.id));
		const nextStory: Story = {
			...story,
			visual: {states: nextStates, version: 1}
		};
		nextStory.passages = story.passages.map(passage => {
			if (!passage.visual) {
				return passage;
			}

			const visual = migrateVisualContent(passage.visual);

			visual.blocks = stripStateReferences(visual.blocks, stateIds);

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
					</select>
					<StateValueInput label={t('dialogs.passageEdit.visual.defaultValue')} state={state} value={state.defaultValue} onChange={defaultValue => updateStates(states.map(item => item.id === state.id ? {...item, defaultValue} : item))} />
					<button onClick={() => updateStates(states.filter(item => item.id !== state.id))} type="button">×</button>
				</div>
			))}
		</section>
	);
};
