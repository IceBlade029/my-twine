import {v4 as uuid} from '@lukeed/uuid';
import {
	IconArrowBack,
	IconArrowDown,
	IconArrowsRight,
	IconArrowsSplit,
	IconArrowUp,
	IconBackpack,
	IconCheck,
	IconChevronDown,
	IconChevronUp,
	IconClock,
	IconCode,
	IconFileImport,
	IconGitBranch,
	IconAlertTriangle,
	IconPlus,
	IconPointer,
	IconRepeat,
	IconSourceCode,
	IconTrash,
	IconTypography,
	IconVariable,
	IconVariablePlus
} from '@tabler/icons';
import type {TFunction} from 'i18next';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../components/control/icon-button';
import {
	backpackSystemStatus,
	BACKPACK_STATE_NAME,
	createBackpackSystem,
	createTimeSystem,
	highlightPassages,
	Passage,
	Story,
	timeSystemStatus,
	VisualBinaryOperator,
	VisualBlock,
	VisualBranch,
	VisualBranchBlock,
	VisualChoiceBlock,
	VisualExpression,
	VisualIncludeBlock,
	VisualInteractionBlock,
	VisualLoopBlock,
	VisualPassageContent,
	VisualPassageContentV2,
	VisualRawBlock,
	VisualReturnMainBlock,
	VisualSetBlock,
	VisualStateAction,
	VisualStoryState,
	VisualSwitchBlock,
	VisualSwitchCase,
	VisualTextBlock,
	VisualVariableBlock,
	updatePassage
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	blocksContainKind,
	compileBlockFragment,
	compileExpression,
	compileStateInitialization,
	compileVisualPassage,
	migrateVisualContent,
	sanitizeVariableName,
	serializeExpressionToCode
} from '../../util/visual-passage';
import {analyzeExpression} from '../../util/expression-analysis';
import {defaultValueForState, StateValueInput} from '../story-states';
import {PassageVisualRunDrawer} from './passage-visual-run-drawer';
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
	set: {
		icon: IconVariablePlus,
		labelKey: 'dialogs.passageEdit.visual.blockKindSet'
	},
	include: {
		icon: IconFileImport,
		labelKey: 'dialogs.passageEdit.visual.blockKindInclude'
	},
	interaction: {
		icon: IconPointer,
		labelKey: 'dialogs.passageEdit.visual.blockKindInteraction'
	},
	raw: {
		icon: IconCode,
		labelKey: 'dialogs.passageEdit.visual.blockKindRaw'
	},
	switch: {
		icon: IconArrowsSplit,
		labelKey: 'dialogs.passageEdit.visual.blockKindSwitch'
	},
	loop: {
		icon: IconRepeat,
		labelKey: 'dialogs.passageEdit.visual.blockKindLoop'
	},
	returnMain: {
		icon: IconArrowBack,
		labelKey: 'dialogs.passageEdit.visual.blockKindReturnMain'
	}
};

/** One entry in the module selector, grouped by the doc 7.1 table. */
interface ModuleEntry {
	kind: VisualBlock['kind'];
	/** Translated Chinese/English module name. */
	labelKey: string;
	/** Technical aliases matched by the selector search. */
	aliases: string[];
	/** One-line description key. */
	descriptionKey: string;
}

const moduleGroups: {titleKey: string; entries: ModuleEntry[]}[] = [
	{
		titleKey: 'dialogs.passageEdit.visual.selectorGroupCommon',
		entries: [
			{
				kind: 'text',
				labelKey: 'dialogs.passageEdit.visual.blockKindText',
				aliases: ['text'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleTextDescription'
			},
			{
				kind: 'choice',
				labelKey: 'dialogs.passageEdit.visual.blockKindChoice',
				aliases: ['choice'],
				descriptionKey:
					'dialogs.passageEdit.visual.moduleChoiceDescription'
			},
			{
				kind: 'branch',
				labelKey: 'dialogs.passageEdit.visual.blockKindBranch',
				aliases: ['if'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleBranchDescription'
			},
			{
				kind: 'set',
				labelKey: 'dialogs.passageEdit.visual.blockKindSet',
				aliases: ['set', 'variable'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleSetDescription'
			}
		]
	},
	{
		titleKey: 'dialogs.passageEdit.visual.selectorGroupControlFlow',
		entries: [
			{
				kind: 'branch',
				labelKey: 'dialogs.passageEdit.visual.blockKindBranch',
				aliases: ['if'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleBranchDescription'
			},
			{
				kind: 'switch',
				labelKey: 'dialogs.passageEdit.visual.blockKindSwitch',
				aliases: ['switch'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleSwitchDescription'
			},
			{
				kind: 'loop',
				labelKey: 'dialogs.passageEdit.visual.blockKindLoop',
				aliases: ['for', 'each', 'loop', 'list'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleLoopDescription'
			}
		]
	},
	{
		titleKey: 'dialogs.passageEdit.visual.selectorGroupContentReuse',
		entries: [
			{
				kind: 'variable',
				labelKey: 'dialogs.passageEdit.visual.blockKindVariable',
				aliases: ['variable', 'show', 'print'],
				descriptionKey:
					'dialogs.passageEdit.visual.moduleVariableDescription'
			},
			{
				kind: 'include',
				labelKey: 'dialogs.passageEdit.visual.blockKindInclude',
				aliases: ['include', 'passage'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleIncludeDescription'
			}
		]
	},
	{
		titleKey: 'dialogs.passageEdit.visual.selectorGroupInteractionActions',
		entries: [
			{
				kind: 'interaction',
				labelKey: 'dialogs.passageEdit.visual.blockKindInteraction',
				aliases: ['reveal', 'append', 'remove', 'link', 'interaction'],
				descriptionKey:
					'dialogs.passageEdit.visual.moduleInteractionDescription'
			},
			{
				kind: 'returnMain',
				labelKey: 'dialogs.passageEdit.visual.blockKindReturnMain',
				aliases: ['return', 'back', 'noreturn', 'menu', 'back to main'],
				descriptionKey:
					'dialogs.passageEdit.visual.moduleReturnMainDescription'
			}
		]
	},
	{
		titleKey: 'dialogs.passageEdit.visual.selectorGroupAdvanced',
		entries: [
			{
				kind: 'raw',
				labelKey: 'dialogs.passageEdit.visual.blockKindRaw',
				aliases: ['raw', 'sugar', 'source', 'sugarcube'],
				descriptionKey: 'dialogs.passageEdit.visual.moduleRawDescription'
			}
		]
	}
];

/**
 * Whether a module entry can be inserted. 遍历列表 (loop) is disabled when the
 * story has no list variables yet.
 */
function moduleEntryDisabled(
	entry: ModuleEntry,
	states: VisualStoryState[]
) {
	return entry.kind === 'loop' && !states.some(state => state.type === 'list');
}

/**
 * Walks a visual block tree and returns a map from each block's id to the
 * translated kind label plus a short display id, used by the 运行检查 trace
 * list so trace entries can be labelled and their blocks selected.
 */
function collectBlockKinds(
	blocks: VisualBlock[],
	t: TFunction
): Record<string, {kindLabel: string; shortId: string}> {
	const result: Record<string, {kindLabel: string; shortId: string}> = {};

	function visit(list: VisualBlock[]) {
		list.forEach(block => {
			result[block.id] = {
				kindLabel: t(blockKindMeta[block.kind].labelKey),
				shortId: block.id.slice(0, 8)
			};

			if (block.kind === 'branch') {
				block.branches.forEach(branch => visit(branch.blocks));
			} else if (block.kind === 'switch') {
				block.cases.forEach(item => visit(item.blocks));
				visit(block.defaultBlocks);
			} else if (block.kind === 'loop') {
				visit(block.blocks);
			}
		});
	}

	visit(blocks);

	return result;
}

function isContainerBlock(block: VisualBlock) {
	return block.kind === 'branch' || block.kind === 'switch' || block.kind === 'loop';
}

function countNestedBlocks(block: VisualBlock): number {
	if (block.kind === 'branch') {
		return block.branches.reduce((total, branch) => total + branch.blocks.length, 0);
	}

	if (block.kind === 'switch') {
		return (
			block.cases.reduce((total, item) => total + item.blocks.length, 0) +
			block.defaultBlocks.length
		);
	}

	return block.kind === 'loop' ? block.blocks.length : 0;
}

function shortened(value: string, fallback: string, maximum = 72) {
	const normalized = value.replace(/\s+/g, ' ').trim();

	if (normalized === '') {
		return fallback;
	}

	return normalized.length > maximum
		? `${normalized.slice(0, maximum - 1)}…`
		: normalized;
}

function blockIsIncomplete(
	block: VisualBlock,
	states: VisualStoryState[],
	insideLoop: boolean
) {
	if (block.kind === 'choice') {
		return (
			block.label.trim() === '' ||
			(!block.specialTarget && block.targetPassageId === '') ||
			(Boolean(block.specialTarget) && block.actions.length > 0)
		);
	}

	if (block.kind === 'variable') {
		return block.source === 'loopItem' ? !insideLoop : !block.stateId;
	}

	if (block.kind === 'set') {
		const state = states.find(item => item.id === block.variableId);

		return (
			!state ||
			compileExpression(block.value, states) === undefined ||
			(block.value.kind === 'loopItem' && !insideLoop) ||
			(block.operation !== '=' && state.type !== 'number')
		);
	}

	if (block.kind === 'raw') {
		return block.sugar.trim() === '';
	}

	if (block.kind === 'include') {
		return block.targetPassageId === '';
	}

	if (block.kind === 'interaction') {
		return block.label.trim() === '';
	}

	if (block.kind === 'returnMain') {
		return block.label.trim() === '';
	}

	if (block.kind === 'switch') {
		return (
			block.stateId === '' ||
			(block.cases.length === 0 && block.defaultBlocks.length === 0)
		);
	}

	if (block.kind === 'loop') {
		return block.stateId === '';
	}

	if (block.kind === 'branch') {
		return block.branches.slice(0, -1).some(item => !item.condition);
	}

	return false;
}

function blockSummaryText(
	block: VisualBlock,
	states: VisualStoryState[],
	story: Story,
	t: TFunction
) {
	const empty = t('dialogs.passageEdit.visual.summaryEmpty');

	if (block.kind === 'text') {
		return shortened(block.text, empty);
	}

	if (block.kind === 'choice') {
		const target = block.specialTarget
			? t(
					block.specialTarget === 'back'
						? 'dialogs.passageEdit.visual.targetBack'
						: 'dialogs.passageEdit.visual.targetReturn'
				)
			: story.passages.find(item => item.id === block.targetPassageId)?.name ?? '—';
		return `${shortened(block.label, empty, 42)} → ${target}`;
	}

	if (block.kind === 'variable') {
		if (block.source === 'loopItem') {
			return '_item';
		}

		const state = states.find(item => item.id === block.stateId);
		return state ? visualStateName(state) : '—';
	}

	if (block.kind === 'set') {
		return setStructureSummary(block, states);
	}

	if (block.kind === 'raw') {
		return shortened(block.sugar, empty);
	}

	if (block.kind === 'include') {
		const target = story.passages.find(item => item.id === block.targetPassageId);
		return `↗ ${target?.name ?? '—'}`;
	}

	if (block.kind === 'interaction') {
		return `${shortened(block.label, empty, 42)} · ${t(
			block.operation === 'reveal'
				? 'dialogs.passageEdit.visual.operationReveal'
				: block.operation === 'append'
					? 'dialogs.passageEdit.visual.operationAppend'
					: 'dialogs.passageEdit.visual.interactionOperationRemove'
		)}`;
	}

	if (block.kind === 'returnMain') {
		return `↩ ${shortened(block.label, empty, 42)}`;
	}

	if (block.kind === 'branch') {
		return t('dialogs.passageEdit.visual.summaryBranch', {
			branches: block.branches.length,
			children: countNestedBlocks(block)
		});
	}

	if (block.kind === 'switch') {
		const state = states.find(item => item.id === block.stateId);
		return t('dialogs.passageEdit.visual.summarySwitch', {
			children: countNestedBlocks(block),
			count: block.cases.length,
			state: state ? visualStateName(state) : '—'
		});
	}

	const state = states.find(item => item.id === block.stateId);
	return t('dialogs.passageEdit.visual.summaryLoop', {
		children: countNestedBlocks(block),
		state: state ? visualStateName(state) : '—'
	});
}

function collectBlockAncestors(blocks: VisualBlock[]) {
	const result: Record<string, string[]> = {};

	function visit(list: VisualBlock[], ancestors: string[]) {
		list.forEach(block => {
			result[block.id] = ancestors;

			if (block.kind === 'branch') {
				block.branches.forEach(branch => visit(branch.blocks, [...ancestors, block.id]));
			} else if (block.kind === 'switch') {
				block.cases.forEach(item => visit(item.blocks, [...ancestors, block.id]));
				visit(block.defaultBlocks, [...ancestors, block.id]);
			} else if (block.kind === 'loop') {
				visit(block.blocks, [...ancestors, block.id]);
			}
		});
	}

	visit(blocks, []);
	return result;
}

function findBlockById(blocks: VisualBlock[], blockId: string): VisualBlock | undefined {
	for (const block of blocks) {
		if (block.id === blockId) {
			return block;
		}

		const nestedLists =
			block.kind === 'branch'
				? block.branches.map(branch => branch.blocks)
				: block.kind === 'switch'
					? [...block.cases.map(item => item.blocks), block.defaultBlocks]
					: block.kind === 'loop'
						? [block.blocks]
						: [];

		for (const nested of nestedLists) {
			const match = findBlockById(nested, blockId);

			if (match) {
				return match;
			}
		}
	}

	return undefined;
}

interface BlockTreeViewState {
	collapsedContainerIds: Set<string>;
	expandedBlockIds: Set<string>;
	onSelectBlock: (blockId: string, container: boolean) => void;
	onToggleContainer: (blockId: string) => void;
	selectedBlockId?: string;
}

/** A value a state can hold during simulation; list states hold string[]. */
type SimulatedValue = boolean | number | string | string[];
/** Renders a visual expression as a short human-readable string. */
export function expressionToText(
	expr: VisualExpression,
	states: VisualStoryState[]
): string {
	switch (expr.kind) {
		case 'literal':
			return String(expr.value);
		case 'loopItem':
			return '_item';
		case 'free':
			return expr.code;
		case 'variable': {
			const state = states.find(item => item.id === expr.variableId);

			return state?.name ?? '?';
		}
		case 'count': {
			const state = states.find(item => item.id === expr.variableId);

			return `${state?.name ?? '?'} count ${String(expr.value)}`;
		}
		case 'unary':
			return `!${expressionToText(expr.operand, states)}`;
		case 'binary': {
			const operator =
				expr.operator === 'includes'
					? 'includes'
					: expr.operator === 'notIncludes'
						? 'not includes'
						: expr.operator;

			return `${expressionToText(expr.left, states)} ${operator} ${expressionToText(
				expr.right,
				states
			)}`;
		}
	}
}

/**
 * Evaluates a visual expression against simulated state values. Structured
 * nodes are evaluated with JavaScript semantics; `loopItem` and `free`
 * expressions cannot be determined and return undefined. An undefined result
 * means "cannot determine" and must never hide a block.
 */
export function evaluateExpression(
	expr: VisualExpression,
	states: VisualStoryState[],
	simulated: Record<string, SimulatedValue>
): boolean | undefined {
	const value = evalExpr(expr, states, simulated);

	return value === undefined ? undefined : Boolean(value);
}

function evalExpr(
	expr: VisualExpression,
	states: VisualStoryState[],
	simulated: Record<string, SimulatedValue>
): boolean | number | string | string[] | undefined {
	switch (expr.kind) {
		case 'literal':
			return expr.value;
		case 'loopItem':
		case 'free':
			return undefined;
		case 'variable': {
			if (simulated[expr.variableId] !== undefined) {
				return simulated[expr.variableId];
			}

			const state = states.find(item => item.id === expr.variableId);

			return state ? (state.defaultValue as boolean | number | string | string[]) : undefined;
		}
		case 'count': {
			const state = states.find(item => item.id === expr.variableId);
			const list =
				simulated[expr.variableId] ?? state?.defaultValue;

			return Array.isArray(list)
				? list.filter(item => item === expr.value).length
				: undefined;
		}
		case 'unary': {
			const operand = evalExpr(expr.operand, states, simulated);

			return operand === undefined ? undefined : !operand;
		}
		case 'binary': {
			const left = evalExpr(expr.left, states, simulated);
			const right = evalExpr(expr.right, states, simulated);

			if (left === undefined || right === undefined) {
				return undefined;
			}

			switch (expr.operator) {
				case '&&':
					return Boolean(left) && Boolean(right);
				case '||':
					return Boolean(left) || Boolean(right);
				case '+':
					return (left as number) + (right as number);
				case '-':
					return (left as number) - (right as number);
				case '==':
					return left == right;
				case '!=':
					return left != right;
				case '>':
					return Number(left) > Number(right);
				case '>=':
					return Number(left) >= Number(right);
				case '<':
					return Number(left) < Number(right);
				case '<=':
					return Number(left) <= Number(right);
				case 'includes':
					return Array.isArray(left)
						? left.includes(String(right))
						: undefined;
				case 'notIncludes':
					return Array.isArray(left)
						? !left.includes(String(right))
						: undefined;
			}
		}
	}
}

function operatorSymbol(operator: VisualBinaryOperator, t: TFunction) {
	if (operator === 'includes') {
		return t('dialogs.passageEdit.visual.operatorIncludes');
	}

	if (operator === 'notIncludes') {
		return t('dialogs.passageEdit.visual.operatorNotIncludes');
	}

	const symbols: Partial<Record<VisualBinaryOperator, string>> = {
		'==': '=',
		'!=': '≠',
		'>': '>',
		'>=': '≥',
		'<': '<',
		'<=': '≤',
		'&&': '&&',
		'||': '||',
		'+': '+',
		'-': '-'
	};

	return symbols[operator] ?? operator;
}

/** Human-readable sentence for a gate expression, e.g. 'When Door is yes'. */
export function conditionSentenceText(
	t: TFunction,
	condition: VisualExpression,
	states: VisualStoryState[]
) {
	return conditionSentence(t, condition, states, false);
}

/** Annotation shown on blocks hidden by the simulator. */
export function hiddenBecauseText(
	t: TFunction,
	condition: VisualExpression,
	states: VisualStoryState[]
) {
	return conditionSentence(t, condition, states, true);
}

function conditionSentence(
	t: TFunction,
	condition: VisualExpression,
	states: VisualStoryState[],
	hidden: boolean
): string {
	// An AND chain of builder rows reads as rows joined by 'and'.
	const rows = conditionRows(condition);

	if (rows && rows.length > 1) {
		return rows
			.map(row => conditionSentence(t, row, states, hidden))
			.join(t('dialogs.passageEdit.visual.and'));
	}

	const parts = conditionInterpolation(t, condition, states);

	if (parts.kind === 'count') {
		return t(
			hidden
				? 'dialogs.passageEdit.visual.hiddenBecauseCount'
				: 'dialogs.passageEdit.visual.conditionSentenceCount',
			parts
		);
	}

	return t(
		hidden
			? 'dialogs.passageEdit.visual.hiddenBecause'
			: 'dialogs.passageEdit.visual.conditionSentence',
		parts
	);
}

function conditionInterpolation(
	t: TFunction,
	condition: VisualExpression,
	states: VisualStoryState[]
) {
	// A count comparison counts an item of a list state.
	if (
		condition.kind === 'binary' &&
		condition.left.kind === 'count' &&
		condition.right.kind === 'literal'
	) {
		const {left, right} = condition;
		const state = states.find(item => item.id === left.variableId);

		return {
			kind: 'count' as const,
			item: String(left.value),
			operator: operatorSymbol(condition.operator, t),
			state: state?.name ?? '?',
			threshold: String(right.value)
		};
	}

	// The sentence template expects a {state, operator, value} three-piece. For
	// a simple binary editor expression we break it apart; anything else falls
	// back to the full expression text.
	if (condition.kind === 'binary') {
		const {left, right} = condition;

		if (left.kind === 'variable' && right.kind === 'literal') {
			const state = states.find(item => item.id === left.variableId);

			return {
				kind: 'plain' as const,
				operator: operatorSymbol(condition.operator, t),
				state: state?.name ?? '?',
				value: String(right.value)
			};
		}
	}

	return {
		kind: 'plain' as const,
		operator: '',
		state: expressionToText(condition, states),
		value: ''
	};
}

function actionOperationWord(
	t: TFunction,
	operation: VisualStateAction['operation']
) {
	const keys = {
		advanceTime: 'dialogs.passageEdit.visual.operationAdvanceTime',
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
	// The time-system action references no state: it uses its own sentence.
	if (action.operation === 'advanceTime') {
		return t('dialogs.passageEdit.visual.actionSentenceAdvanceTime', {
			count: Number(action.value) || 1
		});
	}

	const state = states.find(item => item.id === action.stateId);

	// Backpack push/remove read as item sentences.
	if (
		state?.name === BACKPACK_STATE_NAME &&
		(action.operation === 'push' || action.operation === 'remove')
	) {
		return t(
			action.operation === 'push'
				? 'dialogs.passageEdit.visual.itemSentenceObtain'
				: 'dialogs.passageEdit.visual.itemSentenceConsume',
			{item: String(action.value)}
		);
	}

	return t('dialogs.passageEdit.visual.actionSentence', {
		operation: actionOperationWord(t, action.operation),
		state: state?.name ?? '?',
		value: String(action.value)
	});
}

function groupedActionSentences(
	t: TFunction,
	actions: VisualStateAction[],
	states: VisualStoryState[]
) {
	const rows: Array<{key: string; text: string}> = [];

	actions.forEach((action, index) => {
		const state = states.find(item => item.id === action.stateId);
		const itemAction =
			state?.name === BACKPACK_STATE_NAME &&
			(action.operation === 'push' || action.operation === 'remove');
		const previous = rows[rows.length - 1];
		const previousAction = actions[index - 1];

		if (
			itemAction &&
			previous &&
			previousAction?.operation === action.operation &&
			previousAction.stateId === action.stateId &&
			previousAction.value === action.value
		) {
			const match = previous.text.match(/ × (\d+)$/);
			const count = match ? Number(match[1]) + 1 : 2;
			previous.text = `${actionSentenceText(t, action, states)} × ${count}`;
			return;
		}

		rows.push({
			key: `${index}-${action.operation}-${String(action.value)}`,
			text: itemAction
				? `${actionSentenceText(t, action, states)} × 1`
				: actionSentenceText(t, action, states)
		});
	});

	return rows;
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

		if (evaluateExpression(condition, states, simulated)) {
			return index;
		}
	}

	const elseIndex =
		branches.length > 0 && !branches[branches.length - 1].condition
			? branches.length - 1
			: -1;

	return elseIndex >= 0 ? elseIndex : undefined;
}

/**
 * Returns the index of the case that would run for the given simulated
 * value: the first case whose value strictly equals the simulated state
 * value. Returns undefined when the simulator is closed or when no case
 * matches (the default section runs).
 */
function activeSwitchCaseIndex(
	block: VisualSwitchBlock,
	states: VisualStoryState[],
	simulated?: Record<string, SimulatedValue>
) {
	if (!simulated) {
		return undefined;
	}

	const state = states.find(item => item.id === block.stateId);
	const value = simulated[block.stateId] ?? state?.defaultValue ?? '';

	for (let index = 0; index < block.cases.length; index++) {
		if (value === block.cases[index].value) {
			return index;
		}
	}

	return undefined;
}

/** True when a block with `condition` is hidden by the simulated values. */
function blockIsHidden(
	condition: VisualExpression | undefined,
	states: VisualStoryState[],
	simulated?: Record<string, SimulatedValue>
) {
	if (!simulated || !condition) {
		return false;
	}

	// An expression we cannot determine (undefined) must not hide the block.
	return evaluateExpression(condition, states, simulated) === false;
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

/**
 * A simple builder row the condition editor produces: a plain comparison of a
 * state variable against a literal, or a count comparison of a list state's
 * item occurrences against a threshold literal.
 */
type SimpleCondition = {
	kind: 'binary';
	operator: VisualBinaryOperator;
	left:
		| {kind: 'variable'; variableId: string}
		| {kind: 'count'; variableId: string; value: boolean | number | string};
	right: {kind: 'literal'; value: boolean | number | string};
};

/** Operators the builder can produce directly. */
const SIMPLE_OPERATORS: VisualBinaryOperator[] = [
	'==',
	'!=',
	'>',
	'>=',
	'<',
	'<=',
	'includes',
	'notIncludes'
];

function simpleCondition(
	variableId: string,
	operator: VisualBinaryOperator,
	value: boolean | number | string
): SimpleCondition {
	return {
		kind: 'binary',
		operator,
		left: {kind: 'variable', variableId},
		right: {kind: 'literal', value}
	};
}

/** A 'count of item >= threshold' builder row on a list state. */
function countCondition(
	variableId: string,
	item: boolean | number | string,
	threshold: boolean | number | string
): SimpleCondition {
	return {
		kind: 'binary',
		operator: '>=',
		left: {kind: 'count', variableId, value: item},
		right: {kind: 'literal', value: threshold}
	};
}

/** True when the expression is exactly one builder row. */
function isSimpleCondition(
	condition?: VisualExpression
): condition is SimpleCondition {
	return Boolean(
		condition &&
			condition.kind === 'binary' &&
			SIMPLE_OPERATORS.includes(condition.operator) &&
			(condition.left.kind === 'variable' ||
				(condition.left.kind === 'count' &&
					condition.operator === '>=')) &&
			condition.right.kind === 'literal'
	);
}

/**
 * Flattens a condition into its builder rows: a single row stands alone, an
 * AND chain of rows is split at every `&&`. Returns undefined when the
 * expression is not made only of builder rows (so it can only be edited as
 * free code).
 */
function conditionRows(
	condition?: VisualExpression
): SimpleCondition[] | undefined {
	if (!condition) {
		return undefined;
	}

	if (isSimpleCondition(condition)) {
		return [condition];
	}

	if (condition.kind === 'binary' && condition.operator === '&&') {
		const left = conditionRows(condition.left);
		const right = conditionRows(condition.right);

		if (left && right) {
			return [...left, ...right];
		}
	}

	return undefined;
}

/** Builds a condition from builder rows (an AND chain when more than one). */
function rowsToCondition(rows: SimpleCondition[]): VisualExpression {
	return rows.reduceRight<VisualExpression | undefined>(
		(right, row) =>
			right === undefined
				? row
				: {
						kind: 'binary',
						operator: '&&',
						left: row,
						right
					},
		undefined
	)!;
}

/** Serializes the simple builder shape into a free-code string. */
function serializeSimpleToCode(condition: SimpleCondition, states: VisualStoryState[]) {
	const code = serializeExpressionToCode(condition, states);

	return code ?? expressionToText(condition, states);
}

/**
 * Parses a free-code string back into the simple builder shape when it matches
 * `($var op literal)` (the exact output of serializeSimpleToCode). Returns
 * undefined when the string uses advanced syntax or is not parseable.
 */
function parseSimpleFromCode(
	code: string,
	states: VisualStoryState[]
): SimpleCondition | undefined {
	const trimmed = code.trim();
	const match = /^\(\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>|>=|<|<=)\s*(.*)\)$/.exec(
		trimmed
	);
	const includesMatch = /^\(\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\.includes\(\s*(.*)\)$/.exec(
		trimmed
	);
	const notIncludesMatch = /^!\(\s*\$([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\.includes\(\s*(.*)\)$/.exec(
		trimmed
	);

	if (!match && !includesMatch && !notIncludesMatch) {
		return undefined;
	}

	const name = match?.[1] ?? includesMatch?.[1] ?? notIncludesMatch![1];
	const state = states.find(item => sanitizeVariableName(item.name) === name);

	if (!state) {
		return undefined;
	}

	const rawValue =
		match?.[3] ?? includesMatch?.[2] ?? notIncludesMatch![2];

	// The serialize output wraps values with JSON.stringify.
	let value: boolean | number | string;

	if (rawValue === 'true') {
		value = true;
	} else if (rawValue === 'false') {
		value = false;
	} else if (/^-?\d+$/.test(rawValue)) {
		value = Number(rawValue);
	} else if (/^".*"$/.test(rawValue)) {
		value = rawValue.slice(1, -1);
	} else {
		return undefined;
	}

	let operator: VisualBinaryOperator;

	if (includesMatch) {
		operator = 'includes';
	} else if (notIncludesMatch) {
		operator = 'notIncludes';
	} else {
		operator = match![2] as VisualBinaryOperator;
	}

	return simpleCondition(state.id, operator, value);
}

function ConditionEditor(props: {
	condition?: VisualExpression;
	onChange: (condition?: VisualExpression) => void;
	states: VisualStoryState[];
}) {
	const {condition, onChange, states} = props;
	const {t} = useTranslation();

	// Whether the stored expression is the simple builder shape (one row or
	// an AND chain of rows).
	const rows = conditionRows(condition);
	const startsInExpression =
		condition !== undefined && rows === undefined;
	const [mode, setMode] = React.useState<'builder' | 'expression'>(
		startsInExpression ? 'expression' : 'builder'
	);
	const [freeCode, setFreeCode] = React.useState(
		rows && rows.length === 1
			? serializeSimpleToCode(rows[0], states)
			: condition?.kind === 'free'
				? condition.code
				: ''
	);

	// When the stored expression arrives (or changes) into a non-simple shape,
	// force the editor back to expression mode with its code.
	React.useEffect(() => {
		if (!condition) {
			return;
		}

		const currentRows = conditionRows(condition);

		if (currentRows) {
			// Builder rows (single or an AND chain) stay in builder mode; the
			// free-code field only serves expression mode.
			if (currentRows.length === 1) {
				setFreeCode(serializeSimpleToCode(currentRows[0], states));
			}
		} else if (condition.kind === 'free') {
			setFreeCode(condition.code);
			setMode('expression');
		} else {
			// Advanced structured (unary/compound) expression: keep it but it
			// can only be edited in expression mode.
			setFreeCode(expressionToText(condition, states));
			setMode('expression');
		}
	}, [condition, states]);

	if (!condition) {
		return (
			<>
				<button
					disabled={states.length === 0}
					onClick={() => {
						const state = states[0];
						onChange(
							simpleCondition(
								state.id,
								state.type === 'list' ? 'includes' : '==',
								stateValuePlaceholder(state)
							)
						);
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

	return (
		<div className="condition-editor-wrap">
			<div className="condition-editor-tabs">
				<button
					className={mode === 'builder' ? 'is-active' : undefined}
					disabled={!rows}
					onClick={() => {
						// Builder mode edits the stored rows directly.
						if (rows) {
							setMode('builder');
							return;
						}

						// Expression -> builder is only offered when the free
						// code parses back to a single simple row.
						const parsed = parseSimpleFromCode(freeCode, states);

						if (parsed) {
							onChange(parsed);
							setMode('builder');
						}
					}}
					type="button"
				>
					{t('dialogs.passageEdit.visual.builderMode')}
				</button>
				<button
					className={mode === 'expression' ? 'is-active' : undefined}
					onClick={() => {
						// Builder -> expression: serialize the structured shape.
						if (rows) {
							setFreeCode(
								serializeExpressionToCode(
									rowsToCondition(rows),
									states
								) ?? expressionToText(rowsToCondition(rows), states)
							);
						}
						setMode('expression');
					}}
					type="button"
				>
					{t('dialogs.passageEdit.visual.expressionMode')}
				</button>
			</div>

			{!rows && (
				<p className="empty-state advanced-syntax-note">
					{t('dialogs.passageEdit.visual.advancedSyntaxNote')}
				</p>
			)}

			{mode === 'builder' && rows && (
				<BuilderCondition
					rows={rows}
					onChange={onChange}
					states={states}
				/>
			)}

			{mode === 'expression' && (
				<div className="condition-expression">
					<textarea
						aria-label={t('dialogs.passageEdit.visual.expressionSymbol')}
						onChange={event => {
							const value = event.target.value;
							setFreeCode(value);
							onChange({kind: 'free', code: value});
						}}
						rows={2}
						value={freeCode}
					/>
					<button onClick={() => onChange(undefined)} type="button">×</button>
				</div>
			)}

			<ConditionFeedback condition={condition} states={states} />
		</div>
	);
}

/** The builder-mode editor body: an AND chain of editable condition rows. */
function BuilderCondition(props: {
	rows: SimpleCondition[];
	onChange: (condition?: VisualExpression) => void;
	states: VisualStoryState[];
}) {
	const {rows, onChange, states} = props;
	const {t} = useTranslation();

	function updateRow(index: number, next: SimpleCondition) {
		onChange(
			rowsToCondition(rows.map((row, i) => (i === index ? next : row)))
		);
	}

	function deleteRow(index: number) {
		const nextRows = rows.filter((_, i) => i !== index);

		onChange(nextRows.length === 0 ? undefined : rowsToCondition(nextRows));
	}

	return (
		<>
			{rows.map((row, index) => (
				<div className="condition-row" key={index}>
					{index > 0 && (
						<span className="condition-and">
							{t('dialogs.passageEdit.visual.and')}
						</span>
					)}
					<BuilderConditionRow
						condition={row}
						onUpdate={next => updateRow(index, next)}
						states={states}
					/>
					<button
						aria-label={t(
							'dialogs.passageEdit.visual.removeCondition'
						)}
						onClick={() => deleteRow(index)}
						type="button"
					>×</button>
				</div>
			))}
			<button onClick={() => addRow()} type="button">
				{t('dialogs.passageEdit.visual.addAndCondition')}
			</button>
			<p className="condition-summary">
				{conditionSentenceText(t, rowsToCondition(rows), states)}
			</p>
		</>
	);

	function addRow() {
		const state = states[0];
		const row = state
			? simpleCondition(
					state.id,
					state.type === 'list' ? 'includes' : '==',
					stateValuePlaceholder(state)
				)
			: null;

		if (!row) {
			return;
		}

		onChange(rowsToCondition([...rows, row]));
	}
}

/** One editable row of the builder: state, operator, and value(s). */
function BuilderConditionRow(props: {
	condition: SimpleCondition;
	onUpdate: (next: SimpleCondition) => void;
	states: VisualStoryState[];
}) {
	const {condition, onUpdate, states} = props;
	const {t} = useTranslation();
	const left = condition.left;
	const isCount = left.kind === 'count';
	const variableId = condition.left.variableId;
	const state = states.find(item => item.id === variableId);

	return (
		<div className="condition-editor">
			<select
				aria-label={t('dialogs.passageEdit.visual.conditionState')}
				onChange={event => {
					const nextState = states.find(
						item => item.id === event.target.value
					);
					const nextOperator =
						nextState?.type === 'list' ? 'includes' : '==';
					onUpdate(
						simpleCondition(
							event.target.value,
							nextOperator,
							stateValuePlaceholder(nextState)
						)
					);
				}}
				value={variableId}
			>
				{states.map(item => (
					<option key={item.id} value={item.id}>{item.name}</option>
				))}
			</select>
			<select
				aria-label={t('dialogs.passageEdit.visual.conditionOperator')}
				onChange={event => {
					const operator = event.target.value;

					if (operator === 'countGE') {
						// Morph into a count row: item occurrences >= threshold.
						onUpdate(
							countCondition(
								variableId,
								stateValuePlaceholder(state),
								1
							)
						);
						return;
					}

					if (isCount) {
						// Leaving the count row morphs back to a plain row.
						onUpdate(
							simpleCondition(
								variableId,
								operator as VisualBinaryOperator,
								stateValuePlaceholder(state)
							)
						);
						return;
					}

					onUpdate({
						...condition,
						operator: operator as VisualBinaryOperator
					});
				}}
				value={isCount ? 'countGE' : condition.operator}
			>
				{!isCount && <option value="==">=</option>}
				{!isCount && <option value="!=">≠</option>}
				{!isCount && state?.type === 'number' && (
					<option value=">">&gt;</option>
				)}
				{!isCount && state?.type === 'number' && (
					<option value=">=">&ge;</option>
				)}
				{!isCount && state?.type === 'number' && (
					<option value="<">&lt;</option>
				)}
				{!isCount && state?.type === 'number' && (
					<option value="<=">&le;</option>
				)}
				{!isCount && state?.type === 'list' && (
					<option value="includes">
						{t('dialogs.passageEdit.visual.operatorIncludes')}
					</option>
				)}
				{!isCount && state?.type === 'list' && (
					<option value="notIncludes">
						{t('dialogs.passageEdit.visual.operatorNotIncludes')}
					</option>
				)}
				{state?.type === 'list' && (
					<option value="countGE">
						{t('dialogs.passageEdit.visual.operatorCountGE')}
					</option>
				)}
			</select>
			{isCount ? (
				<>
					<input
						aria-label={t(
							'dialogs.passageEdit.visual.itemCountItem'
						)}
						onChange={event =>
							onUpdate({
								...condition,
								left: {
									kind: 'count',
									variableId,
									value: event.target.value
								}
							})
						}
						value={String(left.value)}
					/>
					<input
						aria-label={t(
							'dialogs.passageEdit.visual.itemCountThreshold'
						)}
						min={1}
						onChange={event =>
							onUpdate({
								...condition,
								right: {
									kind: 'literal',
									value: Math.max(
										Number(event.target.value) || 1,
										1
									)
								}
							})
						}
						type="number"
						value={String(condition.right.value)}
					/>
				</>
			) : (
				<StateValueInput
					label={t('dialogs.passageEdit.visual.conditionValue')}
					onChange={value =>
						onUpdate({
							...condition,
							right: {kind: 'literal', value}
						})
					}
					state={state}
					value={condition.right.value}
				/>
			)}
		</div>
	);
}

/**
 * Instant feedback shown under every condition: the current simulated test
 * value, the variables the expression reads, and a warning for any referenced
 * state that is missing from the story.
 */
function ConditionFeedback(props: {
	condition: VisualExpression;
	states: VisualStoryState[];
}) {
	const {condition, states} = props;
	const {t} = useTranslation();
	const analysis = analyzeExpression(condition, states);
	const missingIds = analysis.unknown
		? []
		: analysis.variableIds.filter(
				id => !states.some(state => state.id === id)
			);
	const variableNames = analysis.variableIds.map(
		id => states.find(state => state.id === id)?.name ?? '?'
	);

	const value = evaluateExpression(condition, states, {});

	return (
		<div className="condition-feedback">
			<p className="empty-state">
				<strong>{t('dialogs.passageEdit.visual.currentTestValue')}:</strong>{' '}
				{value === undefined
					? t('dialogs.passageEdit.visual.unableToDetermine')
					: String(value)}
			</p>
			<p className="empty-state">
				<strong>{t('dialogs.passageEdit.visual.readsVariables')}:</strong>{' '}
				{analysis.unknown
					? t('dialogs.passageEdit.visual.unableToDetermine')
					: variableNames.length > 0
						? variableNames.join(', ')
						: '—'}
			</p>
			{missingIds.length > 0 && (
				<p className="condition-warning">
					{t('dialogs.passageEdit.visual.undefinedVariable')}:{' '}
					{missingIds.join(', ')}
				</p>
			)}
		</div>
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
	const [itemTemplateAction, setItemTemplateAction] = React.useState<
		'obtain' | 'consume' | ''
	>('');
	const [itemTemplateName, setItemTemplateName] = React.useState('');
	const [itemTemplateQuantity, setItemTemplateQuantity] = React.useState(1);
	const backpackState = states.find(
		state => state.name === BACKPACK_STATE_NAME
	);
	const backpackReady = backpackSystemStatus(story).state === 'ready';
	const timeReady = timeSystemStatus(story).state === 'ready';

	return (
		<div className="visual-passage-choice">
			<div className="choice-heading">
				<strong>
					{t('dialogs.passageEdit.visual.choiceNumber', {count: index + 1})}
				</strong>
			</div>
			<div className="choice-route-grid">
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

						// Back/return cannot execute passage-link setter actions. Clear
						// them when switching target so the UI never promises work the
						// SugarCube macro will silently ignore.
						if (value === 'back' || value === 'return') {
							onUpdate({
								actions: [],
								specialTarget: value,
								targetPassageId: ''
							});
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
			</div>
			<div className="choice-detail-grid">
			<div className="choice-condition-panel">
				<span>{t('dialogs.passageEdit.visual.condition')}</span>
				<ConditionEditor
					condition={choice.condition}
					onChange={condition => onUpdate({condition})}
					states={states}
				/>
			</div>
			{choice.specialTarget ? (
				<div className="choice-action-panel">
					<span>{t('dialogs.passageEdit.visual.actions')}</span>
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.specialTargetActionsUnavailable')}
					</p>
				</div>
			) : (
				<div className="choice-actions choice-action-panel">
					<span>{t('dialogs.passageEdit.visual.actions')}</span>
					{(choice.actions ?? []).map((action, actionIndex) => {
					const state = states.find(item => item.id === action.stateId);
					return (
						<div
							className={`action-row action-${
								action.operation === 'advanceTime'
									? 'time'
									: state?.name === BACKPACK_STATE_NAME &&
										(action.operation === 'push' || action.operation === 'remove')
										? 'item'
										: 'state'
							}`}
							key={actionIndex}
						>
							<div className="action-row-heading">
								{action.operation === 'advanceTime' ? (
									<IconClock />
								) : state?.name === BACKPACK_STATE_NAME ? (
									<IconBackpack />
								) : (
									<IconVariablePlus />
								)}
								<span>{actionSentenceText(t, action, states)}</span>
							</div>
							{action.operation !== 'advanceTime' && (
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
							)}
							<select
								aria-label={t('dialogs.passageEdit.visual.actionOperation')}
								onChange={event => {
									const actions = [...(choice.actions ?? [])];
									const operation = event.target
										.value as VisualStateAction['operation'];
									actions[actionIndex] = {
										...action,
										operation,
										// The time-system action always holds a positive
										// step count, whatever the previous operation held.
										value:
											operation === 'advanceTime'
												? Math.max(Number(action.value) || 1, 1)
												: action.value
									};
									onUpdate({actions});
								}}
								value={action.operation}
							>
								<option value="set">
									{t('dialogs.passageEdit.visual.set')}
								</option>
								<option disabled={!timeReady} value="advanceTime">
									{t('dialogs.passageEdit.visual.operationAdvanceTime')}
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
							{action.operation === 'advanceTime' ? (
								<input
									aria-label={t('dialogs.passageEdit.visual.actionSteps')}
									min={1}
									onChange={event => {
										const actions = [...(choice.actions ?? [])];
										actions[actionIndex] = {
											...action,
											value: Math.max(Number(event.target.value) || 1, 1)
										};
										onUpdate({actions});
									}}
									type="number"
									value={String(Number(action.value) || 1)}
								/>
							) : (
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
							)}
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
								state
									? {
											stateId: state.id,
											operation: 'set',
											value: stateValuePlaceholder(state)
										}
									: {
											stateId: '',
											operation: 'advanceTime',
											value: 1
										}
							]
						});
					}}
					type="button"
					>{t('dialogs.passageEdit.visual.addAction')}</button>
					{!timeReady &&
						(choice.actions ?? []).some(
							action => action.operation === 'advanceTime'
						) && (
							<p className="system-action-warning">
								{t('dialogs.passageEdit.visual.timeSystemRequired')}
							</p>
						)}
					<div className="item-template-row">
						<span>{t('dialogs.passageEdit.visual.itemAction')}</span>
						<select
							aria-label={t('dialogs.passageEdit.visual.itemAction')}
							onChange={event =>
								setItemTemplateAction(
									event.target.value as 'obtain' | 'consume' | ''
								)
							}
							value={itemTemplateAction}
						>
							<option value="">
								{t('dialogs.passageEdit.visual.itemActionPlaceholder')}
							</option>
							<option value="obtain">
								{t('dialogs.passageEdit.visual.itemObtain')}
							</option>
							<option value="consume">
								{t('dialogs.passageEdit.visual.itemConsume')}
							</option>
						</select>
						<input
							aria-label={t('dialogs.passageEdit.visual.itemName')}
							onChange={event => setItemTemplateName(event.target.value)}
							placeholder={t('dialogs.passageEdit.visual.itemNamePlaceholder')}
							value={itemTemplateName}
						/>
						<input
							aria-label={t('dialogs.passageEdit.visual.itemQuantity')}
							min={1}
							onChange={event =>
								setItemTemplateQuantity(
									Math.max(Number(event.target.value) || 1, 1)
								)
							}
							type="number"
							value={itemTemplateQuantity}
						/>
						<button
							disabled={
								!itemTemplateAction ||
								!itemTemplateName.trim() ||
								!backpackState ||
								!backpackReady
							}
							onClick={() => {
								const item = itemTemplateName.trim();

								if (
									!itemTemplateAction ||
									!item ||
									!backpackState ||
									!backpackReady
								) {
									return;
								}

								onUpdate({
									actions: [
										...(choice.actions ?? []),
									...Array.from({length: itemTemplateQuantity}, () => ({
										operation:
											itemTemplateAction === 'obtain'
												? ('push' as const)
												: ('remove' as const),
										stateId: backpackState.id,
										value: item
									}))
									]
								});
								setItemTemplateAction('');
								setItemTemplateName('');
								setItemTemplateQuantity(1);
							}}
							type="button"
						>{t('dialogs.passageEdit.visual.addItemAction')}</button>
					</div>
					{!backpackReady && (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.backpackMissingHint')}
						</p>
					)}
					{states.length === 0 && (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.noStatesHint')}
						</p>
					)}
				</div>
			)}
			</div>
			{(choice.actions ?? []).length > 0 && (
				<ul className="choice-actions-summary">
					{groupedActionSentences(t, choice.actions ?? [], states).map(row => (
						<li key={row.key}>{row.text}</li>
					))}
				</ul>
			)}
		</div>
	);
};

interface VariableEditorProps {
	block: VisualVariableBlock;
	disabled?: boolean;
	insideLoop: boolean;
	onUpdate: (props: Partial<VisualVariableBlock>) => void;
	states: VisualStoryState[];
}

const VariableEditor: React.FC<VariableEditorProps> = props => {
	const {block, disabled, insideLoop, onUpdate, states} = props;
	const {t} = useTranslation();
	const source = block.source ?? 'state';

	return (
		<div className="visual-passage-variable">
			<label>
				<span>{t('dialogs.passageEdit.visual.variableSource')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.variableSource')}
					disabled={disabled}
					onChange={event =>
						onUpdate({
							source: event.target.value as VisualVariableBlock['source']
						})
					}
					value={source}
				>
					<option value="state">
						{t('dialogs.passageEdit.visual.sourceState')}
					</option>
					<option disabled={!insideLoop} value="loopItem">
						{t('dialogs.passageEdit.visual.sourceLoopItem')}
					</option>
				</select>
			</label>
			{source === 'state' ? (
				<>
					<label>
						<span>{t('dialogs.passageEdit.visual.variableState')}</span>
						<select
							disabled={disabled}
							onChange={event =>
								onUpdate({stateId: event.target.value})
							}
							value={block.stateId ?? ''}
						>
							<option value="">
								{t('dialogs.passageEdit.visual.chooseState')}
							</option>
							{states.map(item => (
								<option key={item.id} value={item.id}>{item.name}</option>
							))}
						</select>
					</label>
					{(block.stateId ?? '') === '' && (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.blockIncomplete')}
						</p>
					)}
				</>
			) : (
				<>
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.loopItemHint')}
					</p>
					{!insideLoop && (
						<p className="empty-state error-state">
							{t('dialogs.passageEdit.visual.loopItemOutsideLoop')}
						</p>
					)}
				</>
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

interface SetBlockEditorProps {
	block: VisualSetBlock;
	disabled?: boolean;
	insideLoop: boolean;
	onUpdate: (props: Partial<VisualSetBlock>) => void;
	states: VisualStoryState[];
}

/** The source kind shown in the set block's value-source select. */
type SetValueSource = 'constant' | 'variable' | 'loopItem' | 'free';

/** Maps a stored value expression to the matching source kind. */
function setValueSourceOf(expr: VisualExpression): SetValueSource {
	switch (expr.kind) {
		case 'literal':
			return 'constant';
		case 'variable':
			return 'variable';
		case 'loopItem':
			return 'loopItem';
		default:
			return 'free';
	}
}

const SetBlockEditor: React.FC<SetBlockEditorProps> = props => {
	const {block, disabled, insideLoop, onUpdate, states} = props;
	const {t} = useTranslation();
	const state = states.find(item => item.id === block.variableId);
	const source = setValueSourceOf(block.value);
	const [freeCode, setFreeCode] = React.useState(
		block.value.kind === 'free' ? block.value.code : ''
	);

	function setValue(value: VisualExpression) {
		onUpdate({value});
	}

	// The "before -> after" test result line.
	const testResult = setTestResult(block, state, states);

	return (
		<div className="visual-passage-set">
			<label>
				<span>{t('dialogs.passageEdit.visual.setVariable')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.setVariable')}
					disabled={disabled || states.length === 0}
					onChange={event => {
						const nextState = states.find(
							item => item.id === event.target.value
						);
						const next: Partial<VisualSetBlock> = {
							variableId: event.target.value
						};

						if (block.operation !== '=' && nextState?.type !== 'number') {
							next.operation = '=';
						}

						if (block.value.kind === 'literal') {
							next.value = {
								kind: 'literal',
								value: stateValuePlaceholder(nextState)
							};
						}

						onUpdate(next);
					}}
					value={block.variableId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseState')}
					</option>
					{states.map(item => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
			</label>
			{block.variableId === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			<label>
				<span>{t('dialogs.passageEdit.visual.setOperation')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.setOperation')}
					disabled={disabled}
					onChange={event =>
						onUpdate({
							operation: event.target.value as VisualSetBlock['operation']
						})
					}
					value={block.operation}
				>
					<option value="=">=</option>
					{state?.type === 'number' && <option value="+=">+=</option>}
					{state?.type === 'number' && <option value="-=">-=</option>}
				</select>
			</label>
			<label>
				<span>{t('dialogs.passageEdit.visual.valueSource')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.valueSource')}
					disabled={disabled}
					onChange={event => {
						const next = event.target.value as SetValueSource;

						if (next === 'constant') {
							setValue({kind: 'literal', value: stateValuePlaceholder(state)});
						} else if (next === 'variable') {
							setValue({
								kind: 'variable',
								variableId: states[0]?.id ?? ''
							});
						} else if (next === 'loopItem') {
							setValue({kind: 'loopItem'});
						} else {
							setValue({kind: 'free', code: freeCode});
						}
					}}
					value={source}
				>
					<option value="constant">
						{t('dialogs.passageEdit.visual.valueSourceConstant')}
					</option>
					<option value="variable">
						{t('dialogs.passageEdit.visual.valueSourceVariable')}
					</option>
					<option disabled={!insideLoop} value="loopItem">
						{t('dialogs.passageEdit.visual.valueSourceLoopItem')}
					</option>
					<option value="free">
						{t('dialogs.passageEdit.visual.valueSourceFreeExpression')}
					</option>
				</select>
			</label>
			{source === 'constant' && (
				<label>
					<span>{t('dialogs.passageEdit.visual.setValue')}</span>
					<StateValueInput
						label={t('dialogs.passageEdit.visual.setValue')}
						onChange={value => setValue({kind: 'literal', value})}
						state={state}
						value={
							block.value.kind === 'literal'
								? (block.value.value as boolean | number | string)
								: stateValuePlaceholder(state)
						}
					/>
				</label>
			)}
			{source === 'variable' && (
				<label>
					<span>{t('dialogs.passageEdit.visual.valueSourceVariable')}</span>
					<select
						aria-label={t('dialogs.passageEdit.visual.valueSourceVariable')}
						disabled={disabled}
						onChange={event =>
							setValue({kind: 'variable', variableId: event.target.value})
						}
						value={
							block.value.kind === 'variable' ? block.value.variableId : ''
						}
					>
						{states.map(item => (
							<option key={item.id} value={item.id}>{item.name}</option>
						))}
					</select>
				</label>
			)}
			{source === 'loopItem' && (
				<>
					<p className="empty-state">
						{t('dialogs.passageEdit.visual.loopItemValueHint')}
					</p>
					{!insideLoop && (
						<p className="empty-state error-state">
							{t('dialogs.passageEdit.visual.loopItemOutsideLoop')}
						</p>
					)}
				</>
			)}
			{source === 'free' && (
				<label>
					<span>{t('dialogs.passageEdit.visual.valueFreeExpression')}</span>
					<input
						aria-label={t('dialogs.passageEdit.visual.valueFreeExpression')}
						disabled={disabled}
						onChange={event => {
							const value = event.target.value;
							setFreeCode(value);
							setValue({kind: 'free', code: value});
						}}
						value={freeCode}
					/>
				</label>
			)}
			<p className="set-summary">
				{setStructureSummary(block, states)}
				{block.condition && (
					<>
						{' · '}
						{t('dialogs.passageEdit.visual.executionCondition')}:{' '}
						{conditionSentenceText(t, block.condition, states)}
					</>
				)}
			</p>
			{testResult !== undefined && (
				<p className="set-test-result empty-state">
					<strong>{t('dialogs.passageEdit.visual.testResult')}:</strong>{' '}
					{testResult.before === null
						? t('dialogs.passageEdit.visual.unableToDetermine')
						: `${String(testResult.before)} -> ${String(testResult.after)}`}
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

/**
 * Estimates the "before -> after" test result of a set block. The "before"
 * value is the target variable's default, and "after" is computed by applying
 * the = / += / -= operation, resolving variable references to their defaults.
 * Returns undefined when nothing can be shown; a null `before` means the value
 * cannot be determined (e.g. it uses an advanced free expression).
 */
function setTestResult(
	block: VisualSetBlock,
	state: VisualStoryState | undefined,
	states: VisualStoryState[]
): {before: boolean | number | string | string[] | null; after: string | number} | undefined {
	if (!state) {
		return undefined;
	}

	const before = state.defaultValue as boolean | number | string | string[];

	if (block.value.kind === 'free') {
		return {before: null, after: ''};
	}

	// Seed simulated values from each state's default so variable references
	// inside the value expression resolve deterministically.
	const simulated: Record<string, SimulatedValue> = {};

	states.forEach(item => {
		simulated[item.id] = item.defaultValue as SimulatedValue;
	});

	const evaluated = evalExpr(block.value, states, simulated);

	if (evaluated === undefined) {
		return {before: null, after: ''};
	}

	if (block.operation === '=') {
		return {before, after: evaluated as string | number};
	}

	const num = Number(before);
	const delta = Number(evaluated) || 0;

	return {
		before,
		after: block.operation === '+=' ? num + delta : num - delta
	};
}

function setStructureSummary(
	block: VisualSetBlock,
	states: VisualStoryState[]
): string {
	const state = states.find(item => item.id === block.variableId);
	const name = state ? visualStateName(state) : '?';

	return `${name} ${block.operation} ${expressionToText(block.value, states)}`;
}

function visualStateName(state: VisualStoryState) {
	return `$${sanitizeVariableName(state.name)}`;
}

interface RawBlockEditorProps {
	block: VisualRawBlock;
	disabled?: boolean;
	onUpdate: (props: Partial<VisualRawBlock>) => void;
	states: VisualStoryState[];
}

const RawBlockEditor: React.FC<RawBlockEditorProps> = props => {
	const {block, disabled, onUpdate, states} = props;
	const {t} = useTranslation();

	return (
		<div className="visual-passage-raw">
			<label>
				<span>{t('dialogs.passageEdit.visual.rawSugar')}</span>
				<textarea
					aria-label={t('dialogs.passageEdit.visual.rawSugar')}
					disabled={disabled}
					onChange={event => onUpdate({sugar: event.target.value})}
					placeholder={t('dialogs.passageEdit.visual.rawSugar')}
					value={block.sugar}
				/>
			</label>
			{block.sugar.trim() === '' && (
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

interface ReturnMainEditorProps {
	block: VisualReturnMainBlock;
	disabled?: boolean;
	onUpdate: (props: Partial<VisualReturnMainBlock>) => void;
	states: VisualStoryState[];
}

const ReturnMainEditor: React.FC<ReturnMainEditorProps> = props => {
	const {block, disabled, onUpdate, states} = props;
	const {t} = useTranslation();

	return (
		<div className="visual-passage-return-main">
			<label>
				<span>{t('dialogs.passageEdit.visual.returnMainLabel')}</span>
				<input
					aria-label={t('dialogs.passageEdit.visual.returnMainLabel')}
					disabled={disabled}
					onChange={event => onUpdate({label: event.target.value})}
					placeholder={t(
						'dialogs.passageEdit.visual.returnMainLabelPlaceholder'
					)}
					value={block.label}
				/>
			</label>
			<p className="empty-state">
				{t('dialogs.passageEdit.visual.returnMainNote')}
			</p>
			{block.label.trim() === '' && (
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
	insideLoop: boolean;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualBranchBlock>) => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
	treeView: BlockTreeViewState;
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
		insideLoop,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		simulated,
		states,
		story,
		treeView
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
				const isElse = index === branch.branches.length - 1;

				return (
					<div
						className={inactive ? 'branch is-inactive' : 'branch'}
						key={item.id}
					>
						<div className="branch-condition">
							{!isElse ? (
								<>
									<span className="branch-path-label is-match">
										{t('dialogs.passageEdit.visual.whenMatched')}
									</span>
									<ConditionEditor
										condition={item.condition}
										onChange={condition =>
											updateBranch(index, {condition})
										}
										states={states}
									/>
									{!item.condition && (
										<span className="block-status-tag error-status">
											{t('dialogs.passageEdit.visual.statusIncomplete')}
										</span>
									)}
								</>
							) : (
								<span className="branch-path-label is-else">
									{t('dialogs.passageEdit.visual.otherwise')}
								</span>
							)}
							{inactive && (
								<span className="not-hit-badge">
									{t('dialogs.passageEdit.visual.statusNotHit')}
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
							insideLoop={insideLoop}
							onChange={blocks => updateBranch(index, {blocks})}
							onSaveFlushed={onSaveFlushed}
							onSavePending={onSavePending}
							simulated={simulated}
							states={states}
							story={story}
							treeView={treeView}
						/>
					</div>
				);
			})}
			<button disabled={disabled} onClick={addBranch} type="button">
				{t('dialogs.passageEdit.visual.addBranch')}
			</button>
		</div>
	);
};

interface SwitchBlockEditorProps {
	block: VisualSwitchBlock;
	depth: number;
	disabled?: boolean;
	insideLoop: boolean;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualSwitchBlock>) => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
	treeView: BlockTreeViewState;
}

/**
 * Edits a switch block: the state switched on (boolean/number/text states
 * only), one nested block list per case plus an add/remove control, and a
 * default section with its own nested block list. When the simulator is
 * open, cases whose value does not match the simulated state value are
 * dimmed; the default section is dimmed when a case matches.
 */
const SwitchBlockEditor: React.FC<SwitchBlockEditorProps> = props => {
	const {
		block,
		depth,
		disabled,
		insideLoop,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		simulated,
		states,
		story,
		treeView
	} = props;
	const {t} = useTranslation();
	const switchState = states.find(item => item.id === block.stateId);
	const switchableStates = states.filter(state => state.type !== 'list');
	const active = activeSwitchCaseIndex(block, states, simulated);
	const simulatorOpen = simulated !== undefined;

	function updateCase(index: number, props: Partial<VisualSwitchCase>) {
		onUpdate({
			cases: block.cases.map((item, i) =>
				i === index ? {...item, ...props} : item
			)
		});
	}

	function addCase() {
		onUpdate({
			cases: [
				...block.cases,
				{blocks: [], id: uuid(), value: stateValuePlaceholder(switchState)}
			]
		});
	}

	function removeCase(index: number) {
		onUpdate({cases: block.cases.filter((_, i) => i !== index)});
	}

	return (
		<div className="visual-passage-switch">
			<label>
				<span>{t('dialogs.passageEdit.visual.switchState')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.switchState')}
					disabled={disabled || switchableStates.length === 0}
					onChange={event => onUpdate({stateId: event.target.value})}
					value={block.stateId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseState')}
					</option>
					{switchableStates.map(item => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
			</label>
			{block.stateId === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			{block.cases.map((caseItem, index) => {
				const inactive =
					simulatorOpen && (active === undefined || active !== index);

				return (
					<div
						className={inactive ? 'switch-case is-inactive' : 'switch-case'}
						key={caseItem.id}
					>
						<div className="switch-case-heading">
							<span className="switch-path-label">
								{t('dialogs.passageEdit.visual.switchCase')}
							</span>
							{inactive && (
								<span className="not-hit-badge">
									{t('dialogs.passageEdit.visual.statusNotHit')}
								</span>
							)}
							<StateValueInput
								label={t('dialogs.passageEdit.visual.switchCaseValue')}
								onChange={value => updateCase(index, {value})}
								state={switchState}
								value={caseItem.value}
							/>
							<button
								disabled={disabled}
								onClick={() => removeCase(index)}
								type="button"
							>×</button>
						</div>
						<BlockList
							blocks={caseItem.blocks}
							depth={depth + 1}
							disabled={disabled}
							insideLoop={insideLoop}
							onChange={blocks => updateCase(index, {blocks})}
							onSaveFlushed={onSaveFlushed}
							onSavePending={onSavePending}
							simulated={simulated}
							states={states}
							story={story}
							treeView={treeView}
						/>
					</div>
				);
			})}
			<button disabled={disabled} onClick={addCase} type="button">
				{t('dialogs.passageEdit.visual.addCase')}
			</button>
			<div
				className={
					simulatorOpen && active !== undefined
						? 'switch-default is-inactive'
						: 'switch-default'
				}
			>
				<div className="switch-default-heading">
					<span className="switch-path-label is-default">
						{t('dialogs.passageEdit.visual.switchDefault')}
					</span>
					{simulatorOpen && active !== undefined && (
						<span className="not-hit-badge">
							{t('dialogs.passageEdit.visual.statusNotHit')}
						</span>
					)}
				</div>
				<BlockList
					blocks={block.defaultBlocks}
					depth={depth + 1}
					disabled={disabled}
					insideLoop={insideLoop}
					onChange={blocks => onUpdate({defaultBlocks: blocks})}
					onSaveFlushed={onSaveFlushed}
					onSavePending={onSavePending}
					simulated={simulated}
					states={states}
					story={story}
					treeView={treeView}
				/>
			</div>
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

interface LoopBlockEditorProps {
	block: VisualLoopBlock;
	depth: number;
	disabled?: boolean;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	onUpdate: (props: Partial<VisualLoopBlock>) => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
	treeView: BlockTreeViewState;
}

/**
 * Edits a loop block: the list state iterated over (list states only, with a
 * hint when none exist) and a nested block list for the per-item body.
 */
const LoopBlockEditor: React.FC<LoopBlockEditorProps> = props => {
	const {
		block,
		depth,
		disabled,
		onSaveFlushed,
		onSavePending,
		onUpdate,
		simulated,
		states,
		story,
		treeView
	} = props;
	const {t} = useTranslation();
	const listStates = states.filter(state => state.type === 'list');

	return (
		<div className="visual-passage-loop">
			<label>
				<span>{t('dialogs.passageEdit.visual.loopState')}</span>
				<select
					aria-label={t('dialogs.passageEdit.visual.loopState')}
					disabled={disabled || listStates.length === 0}
					onChange={event => onUpdate({stateId: event.target.value})}
					value={block.stateId}
				>
					<option value="">
						{t('dialogs.passageEdit.visual.chooseState')}
					</option>
					{listStates.map(item => (
						<option key={item.id} value={item.id}>{item.name}</option>
					))}
				</select>
			</label>
			{listStates.length === 0 && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.loopListHint')}
				</p>
			)}
			{block.stateId === '' && (
				<p className="empty-state">
					{t('dialogs.passageEdit.visual.blockIncomplete')}
				</p>
			)}
			<div
				aria-label={t('dialogs.passageEdit.visual.loopBody')}
				className="loop-body"
			>
				<span>{t('dialogs.passageEdit.visual.loopBody')}</span>
				<BlockList
					blocks={block.blocks}
					depth={depth + 1}
					disabled={disabled}
					insideLoop
					onChange={blocks => onUpdate({blocks})}
					onSaveFlushed={onSaveFlushed}
					onSavePending={onSavePending}
					simulated={simulated}
					states={states}
					story={story}
					treeView={treeView}
				/>
			</div>
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

interface BlockShellProps {
	block: VisualBlock;
	canMoveDown: boolean;
	canMoveUp: boolean;
	children: React.ReactNode;
	choiceGroup?: {
		actions: number;
		conditions: number;
		count: number;
		end: boolean;
		start: boolean;
	};
	condition?: VisualExpression;
	depth: number;
	disabled?: boolean;
	hidden: boolean;
	icon: React.ComponentType;
	insideLoop: boolean;
	kindLabel: string;
	onDelete: () => void;
	onMoveDown: () => void;
	onMoveUp: () => void;
	states: VisualStoryState[];
	story: Story;
	treeView: BlockTreeViewState;
}

/**
 * Shared chrome around a visual block: the header with the kind icon and
 * label, the condition gate, and the move/delete toolbar, plus a per-block
 * toggle that expands the SugarCube this block would generate. Block kinds only
 * supply their body editor; the shell keeps the layout identical for every
 * kind. The depth prop prepares for a later visual tree overhaul.
 */
const BlockShell: React.FC<BlockShellProps> = props => {
	const {
		block,
		canMoveDown,
		canMoveUp,
		children,
		choiceGroup,
		condition,
		depth,
		disabled,
		hidden,
		icon,
		insideLoop,
		kindLabel,
		onDelete,
		onMoveDown,
		onMoveUp,
		states,
		story,
		treeView
	} = props;
	const {t} = useTranslation();
	const Icon = icon;
	const [showCode, setShowCode] = React.useState(false);
	const container = isContainerBlock(block);
	const collapsed = container && treeView.collapsedContainerIds.has(block.id);
	const expanded = container ? !collapsed : treeView.expandedBlockIds.has(block.id);
	const selected = treeView.selectedBlockId === block.id;
	const incomplete = blockIsIncomplete(block, states, insideLoop);
	const summary = blockSummaryText(block, states, story, t);
	const fragment = React.useMemo(
		() => compileBlockFragment(block, states, story, undefined, insideLoop).trim(),
		[block, insideLoop, states, story]
	);

	return (
		<div
			className={`visual-block block-kind-${block.kind}${selected ? ' is-selected' : ''}${
				expanded ? ' is-expanded' : ' is-compact'
			}${container ? ' is-container' : ''}${
				choiceGroup ? ' is-choice-group-member' : ''
			}${choiceGroup?.start ? ' is-choice-group-start' : ''}${
				choiceGroup?.end ? ' is-choice-group-end' : ''
			}`}
			data-kind={block.kind}
			data-depth={depth}
		>
			{choiceGroup?.start && (
				<div className="choice-group-heading">
					<span>{t('dialogs.passageEdit.visual.choiceGroup')}</span>
					<span className="choice-group-metrics">
						{t('dialogs.passageEdit.visual.choiceGroupMetrics', {
							actions: choiceGroup.actions,
							conditions: choiceGroup.conditions,
							count: choiceGroup.count
						})}
					</span>
				</div>
			)}
			<div className="block-header">
				<button
					aria-expanded={expanded}
					className="block-summary-button"
					onClick={() => treeView.onSelectBlock(block.id, container)}
					type="button"
				>
					<Icon />
					<span className="block-summary-main">
						<span className="block-kind">{kindLabel}</span>
						<span className="block-structure-summary">{summary}</span>
					</span>
					{condition && !hidden && (
						<span className="block-status-tag condition-status">
							{conditionSentenceText(t, condition, states)}
						</span>
					)}
					{hidden && condition && (
						<span className="block-status-tag hidden-badge">
							{t('dialogs.passageEdit.visual.statusHidden')}
						</span>
					)}
					{block.kind === 'choice' && block.actions.length > 0 && (
						<span className="block-status-tag action-status">
							{t('dialogs.passageEdit.visual.summaryActions', {
								count: block.actions.length
							})}
						</span>
					)}
					{incomplete && (
						<span className="block-status-tag error-status">
							{t('dialogs.passageEdit.visual.statusIncomplete')}
						</span>
					)}
				</button>
				<div className="block-toolbar">
					{container && (
						<IconButton
							disabled={disabled}
							icon={collapsed ? <IconChevronDown /> : <IconChevronUp />}
							iconOnly
							label={t(
								collapsed ? 'common.expand' : 'common.collapse'
							)}
							onClick={() => treeView.onToggleContainer(block.id)}
						/>
					)}
					<IconButton
						disabled={disabled}
						icon={<IconCode />}
						iconOnly
						label={t('dialogs.passageEdit.visual.blockCode')}
						onClick={() => setShowCode(open => !open)}
					/>
					<IconButton
						disabled={disabled || !canMoveUp}
						icon={<IconArrowUp />}
						iconOnly
						label={t('dialogs.passageEdit.visual.moveUp')}
						onClick={onMoveUp}
					/>
					<IconButton
						disabled={disabled || !canMoveDown}
						icon={<IconArrowDown />}
						iconOnly
						label={t('dialogs.passageEdit.visual.moveDown')}
						onClick={onMoveDown}
					/>
					<IconButton
						disabled={disabled}
						icon={<IconTrash />}
						iconOnly
						label={t('dialogs.passageEdit.visual.deleteBlock')}
						onClick={onDelete}
						variant="danger"
					/>
				</div>
			</div>
			{showCode && (
				<pre className="block-code-preview">
					{fragment === ''
						? t('dialogs.passageEdit.visual.unableToDetermine')
						: fragment}
				</pre>
			)}
			<div
				className={`visual-block-body${hidden ? ' is-hidden' : ''}${
					expanded ? '' : ' is-collapsed'
				}`}
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
	insideLoop?: boolean;
	onChange: (blocks: VisualBlock[]) => void;
	onSaveFlushed: () => void;
	onSavePending: () => void;
	simulated?: Record<string, SimulatedValue>;
	states: VisualStoryState[];
	story: Story;
	treeView: BlockTreeViewState;
}

const BlockList: React.FC<BlockListProps> = props => {
	const {
		blocks,
		depth = 0,
		disabled,
		insideLoop = false,
		onChange,
		onSaveFlushed,
		onSavePending,
		simulated,
		states,
		story,
		treeView
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
		onChange([
			...blocks,
			{id: uuid(), kind: 'variable', source: 'state', stateId: ''}
		]);
	}

	function addSetBlock() {
		onChange([
			...blocks,
			{
				id: uuid(),
				kind: 'set',
				operation: '=',
				variableId: '',
				value: {kind: 'literal', value: ''}
			}
		]);
	}

	function addRawBlock() {
		onChange([...blocks, {id: uuid(), kind: 'raw', sugar: ''}]);
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

	function addSwitchBlock() {
		onChange([
			...blocks,
			{
				cases: [],
				defaultBlocks: [],
				id: uuid(),
				kind: 'switch',
				stateId: ''
			}
		]);
	}

	function addLoopBlock() {
		onChange([
			...blocks,
			{blocks: [], id: uuid(), kind: 'loop', stateId: ''}
		]);
	}

	function addReturnMainBlock() {
		onChange([
			...blocks,
			{id: uuid(), kind: 'returnMain', label: ''}
		]);
	}

	/** Inserts a fresh block of the given kind at the end of the list. */
	function insertModule(kind: VisualBlock['kind']) {
		if (kind === 'text') {
			addTextBlock();
		} else if (kind === 'choice') {
			addChoiceBlock();
		} else if (kind === 'branch') {
			addBranchBlock();
		} else if (kind === 'variable') {
			addVariableBlock();
		} else if (kind === 'set') {
			addSetBlock();
		} else if (kind === 'raw') {
			addRawBlock();
		} else if (kind === 'include') {
			addIncludeBlock();
		} else if (kind === 'interaction') {
			addInteractionBlock();
		} else if (kind === 'switch') {
			addSwitchBlock();
		} else if (kind === 'loop') {
			addLoopBlock();
		} else if (kind === 'returnMain') {
			addReturnMainBlock();
		}
	}

	const [selectorOpen, setSelectorOpen] = React.useState(false);

	return (
		<div className="visual-block-list" data-depth={depth}>
			{blocks.map((block, index) => {
				const choiceIndex = blocks
					.slice(0, index)
					.filter(item => item.kind === 'choice').length;
				const choiceGroupStart =
					block.kind === 'choice' && blocks[index - 1]?.kind !== 'choice';
				const choiceGroupEnd =
					block.kind === 'choice' && blocks[index + 1]?.kind !== 'choice';
				const choiceRun = choiceGroupStart
					? blocks
							.slice(index)
							.filter((item, runIndex, list) =>
								list.slice(0, runIndex + 1).every(entry => entry.kind === 'choice')
							)
							.filter((item): item is VisualChoiceBlock => item.kind === 'choice')
					: [];
				const meta = blockKindMeta[block.kind];
				const condition = 'condition' in block ? block.condition : undefined;
				const hidden = blockIsHidden(condition, states, simulated);

				return (
					<BlockShell
						block={block}
						canMoveDown={index < blocks.length - 1}
						canMoveUp={index > 0}
						choiceGroup={
							block.kind === 'choice'
								? {
										start: choiceGroupStart,
										end: choiceGroupEnd,
										count: choiceRun.length,
										conditions: choiceRun.filter(item => item.condition).length,
										actions: choiceRun.reduce(
											(total, item) => total + item.actions.length,
											0
										)
									}
								: undefined
						}
						condition={condition}
						depth={depth}
						disabled={disabled}
						hidden={hidden}
						icon={meta.icon}
						insideLoop={insideLoop}
						key={block.id}
						kindLabel={t(meta.labelKey)}
						onDelete={() => deleteBlock(index)}
						onMoveDown={() => moveBlock(index, 1)}
						onMoveUp={() => moveBlock(index, -1)}
						states={states}
						story={story}
						treeView={treeView}
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
								insideLoop={insideLoop}
								onSaveFlushed={onSaveFlushed}
								onSavePending={onSavePending}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								simulated={simulated}
								states={states}
								story={story}
								treeView={treeView}
							/>
						)}
						{block.kind === 'variable' && (
							<VariableEditor
								block={block}
								disabled={disabled}
								insideLoop={insideLoop}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
						{block.kind === 'set' && (
							<SetBlockEditor
								block={block}
								disabled={disabled}
								insideLoop={insideLoop}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
						{block.kind === 'raw' && (
							<RawBlockEditor
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
						{block.kind === 'returnMain' && (
							<ReturnMainEditor
								block={block}
								disabled={disabled}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								states={states}
							/>
						)}
						{block.kind === 'switch' && (
							<SwitchBlockEditor
								block={block}
								depth={depth}
								disabled={disabled}
								insideLoop={insideLoop}
								onSaveFlushed={onSaveFlushed}
								onSavePending={onSavePending}
								onUpdate={props =>
									updateBlock(block.id, {...block, ...props})
								}
								simulated={simulated}
								states={states}
								story={story}
								treeView={treeView}
							/>
						)}
						{block.kind === 'loop' && (
							<LoopBlockEditor
								block={block}
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
								treeView={treeView}
							/>
						)}
					</BlockShell>
				);
			})}
			<div className="block-add-menu">
				<IconButton
					disabled={disabled}
					icon={<IconPlus />}
					label={t('dialogs.passageEdit.visual.addModule')}
					onClick={() => setSelectorOpen(open => !open)}
					variant="create"
				/>
				{selectorOpen && (
					<ModuleSelector
						disabled={disabled}
						onClose={() => setSelectorOpen(false)}
						onInsert={kind => {
							insertModule(kind);
							setSelectorOpen(false);
						}}
						states={states}
					/>
				)}
			</div>
		</div>
	);
};

interface ModuleSelectorProps {
	disabled?: boolean;
	onClose: () => void;
	onInsert: (kind: VisualBlock['kind']) => void;
	states: VisualStoryState[];
}

/**
 * The grouped, searchable module picker opened by the single insert button.
 * Each entry shows the translated module name, an aliased search term, and a
 * one-line description. 遍历列表 is disabled when no list variable exists.
 */
const ModuleSelector: React.FC<ModuleSelectorProps> = props => {
	const {disabled, onClose, onInsert, states} = props;
	const {t} = useTranslation();
	const [query, setQuery] = React.useState('');
	const trimmedQuery = query.trim().toLowerCase();
	const ref = React.useRef<HTMLDivElement>(null);

	// Close on outside click.
	React.useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				onClose();
			}
		};

		window.addEventListener('pointerdown', onPointerDown);

		return () => window.removeEventListener('pointerdown', onPointerDown);
	}, [onClose]);

	// Flatten, filter, and group entries by the search query.
	const groups = moduleGroups
		.map(group => {
			const entries = group.entries.filter(entry => {
				if (trimmedQuery === '') {
					return true;
				}

				const label = t(entry.labelKey).toLowerCase();
				const aliases = entry.aliases.some(alias =>
					alias.toLowerCase().includes(trimmedQuery)
				);

				return label.includes(trimmedQuery) || aliases;
			});

			return {titleKey: group.titleKey, entries};
		})
		.filter(group => group.entries.length > 0);

	return (
		<div ref={ref} className="module-selector">
			<input
				aria-label={t(
					'dialogs.passageEdit.visual.moduleSearchPlaceholder'
				)}
				autoFocus
				onChange={event => setQuery(event.target.value)}
				placeholder={t(
					'dialogs.passageEdit.visual.moduleSearchPlaceholder'
				)}
				type="search"
				value={query}
			/>
			<div className="module-selector-groups">
				{groups.length === 0 ? (
					<p className="empty-state module-no-results">
						{t('components.passageFuzzyFinder.noResults')}
					</p>
				) : (
					groups.map(group => (
						<div className="module-group" key={group.titleKey}>
							<h4 className="module-group-title">
								{t(group.titleKey)}
							</h4>
							{group.entries.map((entry, entryIndex) => {
								const isDisabled =
									disabled || moduleEntryDisabled(entry, states);

								return (
									<button
										className={
											isDisabled
												? 'module-entry is-disabled'
												: 'module-entry'
										}
										disabled={isDisabled}
										key={`${group.titleKey}-${entry.kind}-${entryIndex}`}
										onClick={() => onInsert(entry.kind)}
										title={
											isDisabled
												? t(
														'dialogs.passageEdit.visual.noListStateSelectorReason'
													)
												: undefined
										}
										type="button"
									>
										<span className="module-entry-label">
											{t(entry.labelKey)}
										</span>
										<span className="module-entry-alias">
											{entry.aliases[0]}
										</span>
										<span className="module-entry-description">
											{t(entry.descriptionKey)}
										</span>
									</button>
								);
							})}
						</div>
					))
				)}
			</div>
		</div>
	);
};

interface StorySystemsOverviewProps {
	disabled?: boolean;
	story: Story;
}

/** Compact story-level status cards for the two installed domain systems. */
const StorySystemsOverview: React.FC<StorySystemsOverviewProps> = props => {
	const {disabled, story} = props;
	const {dispatch, stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const time = timeSystemStatus(story);
	const backpack = backpackSystemStatus(story);

	function statusLabel(status: 'missing' | 'incomplete' | 'ready') {
		return t(`dialogs.passageEdit.visual.systemStatus.${status}`);
	}

	function locate(name: string) {
		const target = story.passages.find(passage => passage.name === name);

		if (target) {
			dispatch(highlightPassages(story, [target.id]));
		}
	}

	return (
		<section className="story-systems-overview">
			<div className="system-overview-heading">
				<strong>{t('dialogs.passageEdit.visual.storySystems')}</strong>
				<span>{t('dialogs.passageEdit.visual.storySystemsHint')}</span>
			</div>
			<div className="system-card-list">
				<article className={`system-card system-time is-${time.state}`}>
					<div className="system-card-icon"><IconClock /></div>
					<div className="system-card-content">
						<div className="system-card-title">
							<strong>{t('dialogs.passageEdit.visual.timeSystem')}</strong>
							<span className="system-status">
								{time.state === 'ready' ? <IconCheck /> : <IconAlertTriangle />}
								{statusLabel(time.state)}
							</span>
						</div>
						<span className="system-artifacts">
							{t('dialogs.passageEdit.visual.timeSystemArtifacts')}
						</span>
					</div>
					{time.state === 'ready' ? (
						<button disabled={disabled} onClick={() => locate('StoryCaption')} type="button">
							{t('dialogs.passageEdit.visual.locateSystem')}
						</button>
					) : (
						<button
							disabled={disabled}
							onClick={() =>
								dispatch(createTimeSystem(stories, story), 'undoChange.createTimeSystem')
							}
							type="button"
						>
							{t(
								time.state === 'missing'
									? 'dialogs.passageEdit.visual.createSystem'
									: 'dialogs.passageEdit.visual.repairSystem'
							)}
						</button>
					)}
				</article>
				<article className={`system-card system-backpack is-${backpack.state}`}>
					<div className="system-card-icon"><IconBackpack /></div>
					<div className="system-card-content">
						<div className="system-card-title">
							<strong>{t('dialogs.passageEdit.visual.backpackSystem')}</strong>
							<span className="system-status">
								{backpack.state === 'ready' ? <IconCheck /> : <IconAlertTriangle />}
								{statusLabel(backpack.state)}
							</span>
						</div>
						<span className="system-artifacts">
							{t('dialogs.passageEdit.visual.backpackSystemArtifacts')}
						</span>
					</div>
					{backpack.state === 'ready' ? (
						<button disabled={disabled} onClick={() => locate('背包')} type="button">
							{t('dialogs.passageEdit.visual.locateSystem')}
						</button>
					) : (
						<button
							disabled={disabled}
							onClick={() =>
								dispatch(
									createBackpackSystem(stories, story),
									'undoChange.createBackpackSystem'
								)
							}
							type="button"
						>
							{t(
								backpack.state === 'missing'
									? 'dialogs.passageEdit.visual.createSystem'
									: 'dialogs.passageEdit.visual.repairSystem'
							)}
						</button>
					)}
				</article>
			</div>
		</section>
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
	const [selectedBlockId, setSelectedBlockId] = React.useState<
		string | undefined
	>(undefined);
	const [expandedBlockIds, setExpandedBlockIds] = React.useState(
		() => new Set<string>()
	);
	const [collapsedContainerIds, setCollapsedContainerIds] = React.useState(
		() => new Set<string>()
	);
	const [simulatedValues, setSimulatedValues] = React.useState<
		Record<string, SimulatedValue>
	>({});
	const [simulatorOpen, setSimulatorOpen] = React.useState(false);
	const content = React.useMemo(
		() => migrateVisualContent(passage.visual),
		[passage.visual]
	);
	const states = story.visual?.states ?? [];
	const blockAncestors = React.useMemo(
		() => collectBlockAncestors(content.blocks),
		[content.blocks]
	);

	React.useEffect(() => {
		setSelectedBlockId(undefined);
		setExpandedBlockIds(new Set());
		setCollapsedContainerIds(new Set());
	}, [passage.id]);

	const handleSelectBlock = React.useCallback(
		(blockId: string, container: boolean) => {
			setSelectedBlockId(blockId);

			if (!container) {
				setExpandedBlockIds(current => {
					const next = new Set(current);

					if (next.has(blockId)) {
						next.delete(blockId);
					} else {
						next.add(blockId);
					}

					return next;
				});
			}
		},
		[]
	);
	const handleToggleContainer = React.useCallback((blockId: string) => {
		setCollapsedContainerIds(current => {
			const next = new Set(current);

			if (next.has(blockId)) {
				next.delete(blockId);
			} else {
				next.add(blockId);
			}

			return next;
		});
	}, []);
	const handleTraceSelectBlock = React.useCallback(
		(blockId?: string) => {
			if (!blockId) {
				setSelectedBlockId(undefined);
				return;
			}

			const block = findBlockById(content.blocks, blockId);

			setSelectedBlockId(blockId);
			if (block && !isContainerBlock(block)) {
				setExpandedBlockIds(current => new Set([...current, blockId]));
			}
			setCollapsedContainerIds(current => {
				const next = new Set(current);

				(blockAncestors[blockId] ?? []).forEach(id => next.delete(id));
				return next;
			});
		},
		[blockAncestors, content.blocks]
	);
	const treeView = React.useMemo<BlockTreeViewState>(
		() => ({
			collapsedContainerIds,
			expandedBlockIds,
			onSelectBlock: handleSelectBlock,
			onToggleContainer: handleToggleContainer,
			selectedBlockId
		}),
		[
			collapsedContainerIds,
			expandedBlockIds,
			handleSelectBlock,
			handleToggleContainer,
			selectedBlockId
		]
	);

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
			// A passage that holds a return-main block is a menu area: it gets
			// the `noreturn` tag (the convention the block's compiled capture
			// reads), which is dropped again once the last such block is gone.
			const hasReturnMain = blocksContainKind(content.blocks, 'returnMain');
			const tags = hasReturnMain
				? passage.tags.includes('noreturn')
					? passage.tags
					: [...passage.tags, 'noreturn']
				: passage.tags.filter(tag => tag !== 'noreturn');

			dispatch(
				updatePassage(story, passage, {
					tags,
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

	// Id -> {kindLabel, shortId} for the run-drawer trace list, plus the
	// fully traced compiled source shown on the SugarCube tab.
	const blockLabelMap = React.useMemo(
		() => collectBlockKinds(content.blocks, t),
		[content.blocks, t]
	);
	const runCompiledSource = React.useMemo(
		() => compileVisualPassage(content, story, passage.id, {trace: true}),
		[content, passage.id, story]
	);

	return (
		<div className="passage-visual-editor">
			<div className="visual-editor-header">
				<span className="save-indicator">
					{pendingSaves > 0
						? t('dialogs.passageEdit.visual.saving')
						: t('dialogs.passageEdit.visual.saved')}
				</span>
			</div>
			<StorySystemsOverview disabled={disabled} story={story} />
			{passage.name === 'StoryInit' && states.length > 0 && (
				<section className="story-init-preview">
					<div className="section-heading">
						<h4>{t('dialogs.passageEdit.visual.storyInitPreview')}</h4>
					</div>
					<pre>{compileStateInitialization(states)}</pre>
				</section>
			)}
			<section className="visual-passage-blocks">
				<div className="section-heading">
					<h3>{t('dialogs.passageEdit.visual.structureTitle')}</h3>
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
					treeView={treeView}
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

			<section className="simulator-section run-check-section">
				<button
					aria-expanded={simulatorOpen}
					onClick={() => setSimulatorOpen(open => !open)}
					type="button"
				>
					{t('dialogs.passageEdit.visual.runtimeDrawer')}
				</button>
				{simulatorOpen && (
					<PassageVisualRunDrawer
						blockLabelMap={blockLabelMap}
						compiledSource={runCompiledSource}
						onSelectBlock={handleTraceSelectBlock}
						onSimulatedValuesChange={setSimulatedValues}
						passage={passage}
						selectedBlockId={selectedBlockId}
						simulatedValues={simulatedValues}
						states={states}
						story={story}
					/>
				)}
			</section>
		</div>
	);
};
