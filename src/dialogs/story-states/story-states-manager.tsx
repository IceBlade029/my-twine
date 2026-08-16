import {v4 as uuid} from '@lukeed/uuid';
import {IconPlus} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {passageDefaults} from '../../store/stories/defaults';
import {
	Passage,
	Story,
	VisualBlock,
	VisualExpression,
	VisualStateAction,
	VisualStoryState,
	updateStory
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	compileVisualPassage,
	emptyVisualPassage,
	migrateVisualContent,
	sanitizeVariableName
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

/**
 * Finds an unoccupied spot for a new passage. Each candidate begins at
 * (25, 25) and nudges right by (width + gap) until its rectangle no longer
 * overlaps any existing passage, so StoryInit never lands on top of content.
 */
function findFreePlacement(
	passages: Array<Pick<Passage, 'height' | 'left' | 'top' | 'width'>>
) {
	const width = passageDefaults().width;
	const gap = width + 30;

	const overlaps = (left: number, top: number) =>
		passages.some(
			item =>
				left < item.left + item.width &&
				left + width > item.left &&
				top < item.top + item.height &&
				top + passageDefaults().height > item.top
		);

	let left = 25;
	const top = 25;

	while (overlaps(left, top)) {
		left += gap;
	}

	return {left, top};
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
 * Pragmatic compatibility check for a gate expression. Only the simple shape
 * produced by the condition editor — a binary comparison of a single variable
 * against a literal — is checked against the state's type; every other shape
 * (compound expressions, free code, missing state) is kept (unknown).
 */
export function isExpressionCompatible(
	expr: VisualExpression,
	state?: VisualStoryState
): boolean {
	if (!state) {
		return true; // unknown shape rides along rather than being dropped
	}

	if (
		expr.kind !== 'binary' ||
		expr.left.kind !== 'variable' ||
		expr.right.kind !== 'literal'
	) {
		return true;
	}

	if (expr.operator === '>' || expr.operator === '>=') {
		return state.type === 'number';
	}

	if (expr.operator === '<' || expr.operator === '<=') {
		return state.type === 'number';
	}

	if (expr.operator === 'includes' || expr.operator === 'notIncludes') {
		return state.type === 'list';
	}

	// ==/!= work for every type.
	return true;
}

/**
 * True when an expression references the given state id. Structured nodes are
 * walked exactly; a free expression is treated as NOT referencing (unknown),
 * so it is never stripped on deletion.
 */
export function expressionReferencesVariable(
	expr: VisualExpression,
	stateId: string
): boolean {
	switch (expr.kind) {
		case 'literal':
		case 'loopItem':
		case 'free':
			return false;
		case 'variable':
			return expr.variableId === stateId;
		case 'unary':
			return expressionReferencesVariable(expr.operand, stateId);
		case 'binary':
			return (
				expressionReferencesVariable(expr.left, stateId) ||
				expressionReferencesVariable(expr.right, stateId)
			);
	}
}

/**
 * Returns undefined when a gate expression references a deleted state or uses
 * an operator incompatible with the (still-present) state's type; otherwise
 * returns the expression unchanged. A free expression is never stripped.
 */
function stripCondition(
	condition: VisualExpression | undefined,
	statesById: Map<string, VisualStoryState>
): VisualExpression | undefined {
	if (!condition) {
		return undefined;
	}

	const variableIds: string[] = [];

	// Reuse the analysis's read walk semantics through the manager's own
	// walker so free expressions degrade to "not referencing" (kept). A
	// structured-only walk returns true.
	const structured = collectStructuredVariableIds(condition, variableIds);

	if (structured) {
		// Expression built only from structured nodes: drop it if any
		// referenced state is gone or type-incompatible.
		for (const id of variableIds) {
			const state = statesById.get(id);

			if (!state) {
				return undefined;
			}

			if (!isExpressionCompatible(condition, state)) {
				return undefined;
			}
		}

		return condition;
	}

	// A free or otherwise opaque expression is kept (never stripped).
	return condition;
}

/** Collects the state ids referenced by structured nodes in `expr`. */
function collectStructuredVariableIds(
	expr: VisualExpression,
	output: string[]
): boolean {
	switch (expr.kind) {
		case 'literal':
		case 'loopItem':
			return true;
		case 'variable':
			output.push(expr.variableId);
			return true;
		case 'unary':
			return collectStructuredVariableIds(expr.operand, output);
		case 'binary':
			return (
				collectStructuredVariableIds(expr.left, output) &&
				collectStructuredVariableIds(expr.right, output)
			);
		case 'free':
		default:
			return false;
	}
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
				condition: stripCondition(block.condition, statesById)
			};
		}

		if (block.kind === 'choice') {
			return {
				...block,
				actions: block.actions.filter(action =>
					isActionCompatible(action, statesById.get(action.stateId))
				),
				condition: stripCondition(block.condition, statesById)
			};
		}

		if (block.kind === 'set') {
			return {
				...block,
				variableId: statesById.has(block.variableId)
					? block.variableId
					: '',
				condition: stripCondition(block.condition, statesById)
			};
		}

		// A variable block whose state was deleted becomes incomplete; its
		// condition is stripped like any other block's. A loop item block has
		// no state, so nothing to clear: only its condition is stripped.
		if (block.kind === 'variable') {
			return {
				...block,
				stateId:
					block.source === 'loopItem' || block.stateId === undefined
						? block.stateId
						: statesById.has(block.stateId)
							? block.stateId
							: '',
				condition: stripCondition(block.condition, statesById)
			};
		}

		// A raw block is like a text block: its condition is stripped when the
		// referenced state is deleted, but the block itself (and its sugar)
		// survives.
		if (block.kind === 'raw') {
			return {
				...block,
				condition: stripCondition(block.condition, statesById)
			};
		}

		if (block.kind === 'include') {
			return {
				...block,
				condition: stripCondition(block.condition, statesById)
			};
		}

		// An interaction block is like a text block: its condition is stripped
		// when the referenced state is deleted, but the block itself survives.
		if (block.kind === 'interaction') {
			return {
				...block,
				condition: stripCondition(block.condition, statesById)
			};
		}

		// A switch block names the state it switches on: a deleted state makes
		// the block incomplete. Nested case/default blocks are stripped
		// recursively like any other block list.
		if (block.kind === 'switch') {
			return {
				...block,
				stateId: statesById.has(block.stateId) ? block.stateId : '',
				cases: block.cases.map(caseItem => ({
					...caseItem,
					blocks: stripStateReferences(caseItem.blocks, statesById)
				})),
				defaultBlocks: stripStateReferences(
					block.defaultBlocks,
					statesById
				),
				condition: stripCondition(block.condition, statesById)
			};
		}

		// A loop block names the list state it iterates: a deleted state makes
		// the block incomplete. The nested body is stripped recursively.
		if (block.kind === 'loop') {
			return {
				...block,
				stateId: statesById.has(block.stateId) ? block.stateId : '',
				blocks: stripStateReferences(block.blocks, statesById),
				condition: stripCondition(block.condition, statesById)
			};
		}

		return {
			...block,
			branches: block.branches.map(branch => ({
				...branch,
				condition: stripCondition(branch.condition, statesById),
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

		const existingStoryInit = story.passages.find(
			passage => passage.name === 'StoryInit'
		);

		// When states exist but no StoryInit passage does yet, auto-create one
		// so the generated initialization is owned by a real passage SugarCube
		// runs once at startup. It is added before passages are recompiled so
		// every passage sees StoryInit as the initialization owner.
		if (nextStates.length > 0 && !existingStoryInit) {
			const placement = findFreePlacement(story.passages);
			const initPassage = {
				...passageDefaults(),
				id: uuid(),
				left: placement.left,
				name: 'StoryInit',
				story: story.id,
				top: placement.top,
				visual: emptyVisualPassage()
			};

			nextStory.passages = [...story.passages, initPassage];
		} else {
			nextStory.passages = story.passages;
		}

		nextStory.passages = nextStory.passages.map(passage => {
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
			{states.map(state => {
				const sanitized = sanitizeVariableName(state.name);
				const conflicts = states.some(
					other =>
						other.id !== state.id &&
						sanitizeVariableName(other.name) === sanitized
				);

				return (
					<div className="state-row" key={state.id}>
						<input
							aria-label={t('dialogs.passageEdit.visual.stateName')}
							onChange={event => updateStates(states.map(item => item.id === state.id ? {...item, name: event.target.value} : item))}
							value={state.name}
						/>
						{conflicts && sanitized !== '' && (
							<p className="state-name-warning">
								{t('dialogs.passageEdit.visual.nameConflictWarning', {
									name: sanitized
								})}
							</p>
						)}
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
				);
			})}
		</section>
	);
};
