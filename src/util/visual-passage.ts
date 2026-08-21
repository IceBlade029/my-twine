import {v4 as uuid} from '@lukeed/uuid';
import {
	Passage,
	Story,
	VisualBlock,
	VisualExpression,
	VisualPassageContent,
	VisualPassageContentV2,
	VisualStateAction,
	VisualStoryState
} from '../store/stories';

/**
 * Derives a SugarCube-safe variable name from an author-chosen state name.
 * Every character not matching [a-zA-Z0-9_] becomes an underscore, an empty
 * result becomes "variable", and a leading digit is prefixed with an
 * underscore.
 */
export function sanitizeVariableName(name: string): string {
	let result = name.replace(/[^a-zA-Z0-9_]/g, '_');

	if (result === '') {
		result = 'variable';
	}

	if (/^[0-9]/.test(result)) {
		result = '_' + result;
	}

	return result;
}

export function visualStateVariable(state: VisualStoryState) {
	return `$${sanitizeVariableName(state.name)}`;
}

/**
 * Derives the hook id used by an interaction block's link and span from the
 * block's stable editor id. SugarCube selectors only accept alphanumerics and
 * underscores, so every other character is replaced with an underscore.
 */
export function interactionHookId(blockId: string) {
	return `nrp_hook_${blockId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function sugarCubeValue(value: boolean | number | string | string[]) {
	// JSON.stringify serializes string arrays as SugarCube array literals.
	return JSON.stringify(value);
}

/**
 * Compiles the `<<if ndef>>…<</if>>` guard block that initializes each story
 * state to its default once at start of play. Each state becomes a guarded set
 * so existing saved games are never overwritten. Returns an empty string when
 * there are no states.
 */
export function compileStateInitialization(states: VisualStoryState[]): string {
	return states
		.map(
			state =>
				`<<if ndef ${visualStateVariable(state)}>><<set ${visualStateVariable(
					state
				)} = ${sugarCubeValue(state.defaultValue)}>><</if>>`
		)
		.join('\n');
}

/**
 * Compiles a visual expression to SugarCube source. Returns undefined when a
 * referenced state is missing or a needed sub-expression is not compilable,
 * so callers can skip a whole piece (mirroring the old missing-state
 * behavior). A `free` expression is emitted verbatim.
 */
export function compileExpression(
	expr: VisualExpression,
	states: VisualStoryState[]
): string | undefined {
	switch (expr.kind) {
		case 'literal':
			return JSON.stringify(expr.value);
		case 'loopItem':
			return '_item';
		case 'free':
			return expr.code.trim() === '' ? undefined : expr.code;
		case 'variable': {
			const state = states.find(item => item.id === expr.variableId);

			return state ? visualStateVariable(state) : undefined;
		}
		case 'count': {
			// Counts occurrences of the item value in a list state, e.g. the
			// material count behind a crafting recipe.
			const state = states.find(item => item.id === expr.variableId);

			if (!state || state.type !== 'list') {
				return undefined;
			}

			return `(${visualStateVariable(state)}).count(${JSON.stringify(
				expr.value
			)})`;
		}
		case 'unary': {
			const operand = compileExpression(expr.operand, states);

			return operand === undefined ? undefined : `(!${operand})`;
		}
		case 'binary': {
			const left = compileExpression(expr.left, states);
			const right = compileExpression(expr.right, states);

			if (left === undefined || right === undefined) {
				return undefined;
			}

			if (expr.operator === 'includes') {
				return `(${left}).includes(${right})`;
			}

			if (expr.operator === 'notIncludes') {
				return `!(${left}).includes(${right})`;
			}

			return `(${left} ${expr.operator} ${right})`;
		}
	}
}

function compileAction(action: VisualStateAction, states: VisualStoryState[]) {
	// The time-system action references no state: it calls the story-level
	// time engine installed in the story's JavaScript (see
	// create-time-system.ts). The value is the number of periods advanced.
	if (action.operation === 'advanceTime') {
		return `setup.time.advance(${Number(action.value) || 1})`;
	}

	const state = states.find(item => item.id === action.stateId);

	if (!state) {
		return undefined;
	}

	const variable = visualStateVariable(state);

	if (action.operation === 'increase') {
		return `${variable} += ${Number(action.value) || 0}`;
	}

	if (action.operation === 'decrease') {
		return `${variable} -= ${Number(action.value) || 0}`;
	}

	if (action.operation === 'push') {
		return `${variable}.push(${sugarCubeValue(action.value)})`;
	}

	if (action.operation === 'remove') {
		return `${variable}.delete(${sugarCubeValue(action.value)})`;
	}

	if (action.operation === 'clear') {
		return `${variable} = []`;
	}

	return `${variable} = ${sugarCubeValue(action.value)}`;
}

/**
 * Compiles a single block in isolation, so the per-block code preview in the
 * editor shows exactly what that block would generate. It reuses the full
 * compiler with just that block so nested blocks (branches, loops, switches)
 * compile identically to the whole-passage result.
 */
export function compileBlockFragment(
	block: VisualBlock,
	states: VisualStoryState[],
	story: Story,
	passageId?: string,
	insideLoop = false
): string {
	return compileBlocks([block], states, story, passageId, false, insideLoop).join('\n');
}

/**
 * Converts a structured VisualExpression into the same SugarCube source string
 * the compiler would emit (short-circuited back to SugarCube source). Used by
 * the condition editor's builder->expression switch so the free-code field
 * starts from the exact generated expression. Returns undefined when the
 * expression is not compilable (e.g. references a missing state).
 */
export function serializeExpressionToCode(
	expr: VisualExpression,
	states: VisualStoryState[]
): string | undefined {
	return compileExpression(expr, states);
}

/**
 * Converts any supported visual content version into v2. V1 content (a flat
 * body plus choices) becomes an ordered block tree: the body (plus its
 * condition) becomes a single text block, and each choice becomes a choice
 * block. The conversion is lossless: an empty v1 passage becomes an empty
 * block list.
 */
export function migrateVisualContent(
	content: VisualPassageContent
): VisualPassageContentV2 {
	if (content.version === 2) {
		return content;
	}

	const blocks: VisualBlock[] = [];

	if (content.body !== '' || content.bodyCondition) {
		blocks.push({
			kind: 'text',
			id: uuid(),
			text: content.body,
			condition: content.bodyCondition
		});
	}

	blocks.push(
		...content.choices.map(choice => ({
			kind: 'choice' as const,
			id: choice.id,
			label: choice.label,
			targetPassageId: choice.targetPassageId,
			condition: choice.condition,
			actions: choice.actions ?? []
		}))
	);

	return {version: 2, blocks};
}

function compileBlocks(
	blocks: VisualBlock[],
	states: VisualStoryState[],
	story: Story,
	passageId?: string,
	trace = false,
	insideLoop = false
): string[] {
	return blocks.reduce<string[]>((output, block) => {
		// Trace markers surround every block fragment so the runtime drawer can
		// highlight which blocks actually executed. Ignored unless trace runs.
		const mark = (piece: string) =>
			trace
				? `<<script>>window.__trace.push({b:${JSON.stringify(
						block.id
					)},ev:"s"})<</script>>${piece}<<script>>window.__trace.push({b:${JSON.stringify(
						block.id
					)},ev:"e"})<</script>>`
				: piece;
		// Wraps a condition (if present) so its result is recorded; mirror of
		// the non-trace `<<if ${condition}>>` wrapper.
		const withTraceCondition = (piece: string, condition?: string) => {
			if (!trace) {
				return condition ? `<<if ${condition}>>${piece}<</if>>` : piece;
			}

			return condition
				? `<<if (window.__trace.push({c:${JSON.stringify(
						block.id
					)},r:${condition}}), ${condition})>>${piece}<</if>>`
				: piece;
		};

		if (block.kind === 'text') {
			const text = block.text.trim();

			if (!text && !block.condition) {
				return output;
			}

			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(text, condition)));
			return output;
		}

		if (block.kind === 'choice') {
			const label = block.label.trim();

			if (!label) {
				return output;
			}

			// A special target navigates back/return instead of to a passage.
			// It has no setter; the target passage id and actions are ignored
			// while specialTarget is set.
			if (block.specialTarget === 'back' || block.specialTarget === 'return') {
				const link = `<<${block.specialTarget} ${JSON.stringify(label)}>>`;
				const condition = block.condition
					? compileExpression(block.condition, states)
					: undefined;

				output.push(mark(withTraceCondition(link, condition)));
				return output;
			}

			const target = story.passages.find(
				passage => passage.id === block.targetPassageId
			);

			if (!target) {
				return output;
			}

			const actions = (block.actions ?? [])
				.map(action => compileAction(action, states))
				.filter((action): action is string => Boolean(action));
			const setter = actions.length > 0 ? `[${actions.join('; ')}]` : '';
			const link = `[[${label}->${target.name}]${setter}]`;
			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(link, condition)));
			return output;
		}

		if (block.kind === 'interaction') {
			const label = block.label.trim();

			if (!label) {
				return output;
			}

			// The hook id doubles as the span id and the SugarCube selector.
			const hook = `#${interactionHookId(block.id)}`;
			const quotedLabel = JSON.stringify(label);

			// Remove starts with the content in place and clears it on click;
			// reveal and append start empty and fill it on click.
			let code: string;

			if (block.operation === 'reveal') {
				code = `<<link ${quotedLabel}>><<replace "${hook}">>${block.content}<</replace>><</link>><span id="${hook}"></span>`;
			} else if (block.operation === 'append') {
				code = `<<link ${quotedLabel}>><<append "${hook}">>${block.content}<</append>><</link>><span id="${hook}"></span>`;
			} else {
				code = `<<link ${quotedLabel}>><<remove "${hook}">><</link>><span id="${hook}">${block.content}</span>`;
			}

			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(code, condition)));
			return output;
		}

		if (block.kind === 'raw') {
			// Skip whitespace-only blocks, but emit the sugar verbatim once it
			// has content: no trimming of the actual source.
			if (block.sugar.trim() === '') {
				return output;
			}

			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(block.sugar, condition)));
			return output;
		}

		if (block.kind === 'variable') {
			if (block.source === 'loopItem') {
				if (!insideLoop) {
					return output;
				}

				const code = '<<print _item>>';
				const condition = block.condition
					? compileExpression(block.condition, states)
					: undefined;

				output.push(mark(withTraceCondition(code, condition)));
				return output;
			}

			const state = states.find(item => item.id === block.stateId);

			if (!state) {
				return output;
			}

			const code = `<<print ${visualStateVariable(state)}>>`;
			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(code, condition)));
			return output;
		}

		if (block.kind === 'set') {
			const state = states.find(item => item.id === block.variableId);

			// The set block needs a resolvable target state and a compilable
			// value expression, otherwise there is nothing to emit.
			if (!state) {
				return output;
			}

			const value = compileExpression(block.value, states);

			if (
				value === undefined ||
				(block.value.kind === 'loopItem' && !insideLoop) ||
				(block.operation !== '=' && state.type !== 'number')
			) {
				return output;
			}

			const code = `<<set ${visualStateVariable(
				state
			)} ${block.operation} ${value}>>`;

			output.push(
				mark(
					withTraceCondition(
						code,
						block.condition
							? compileExpression(block.condition, states)
							: undefined
					)
				)
			);
			return output;
		}

		if (block.kind === 'include') {
			const target = story.passages.find(
				passage => passage.id === block.targetPassageId
			);

			if (!target) {
				return output;
			}

			const code = `<<include ${JSON.stringify(target.name)}>>`;
			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(code, condition)));
			return output;
		}

		if (block.kind === 'switch') {
			const state = states.find(item => item.id === block.stateId);

			// A switch needs a resolvable state and at least one case or a
			// default body, otherwise there is nothing to compile.
			if (!state || (block.cases.length === 0 && block.defaultBlocks.length === 0)) {
				return output;
			}

			const cases = block.cases
				.map(
					caseItem =>
						`<<case ${sugarCubeValue(
							caseItem.value
						)}>>${compileBlocks(
							caseItem.blocks,
							states,
							story,
							passageId,
							trace,
							insideLoop
						).join('\n')}`
				)
				.join('');
			const defaultCode =
				block.defaultBlocks.length > 0
					? `<<default>>${compileBlocks(
							block.defaultBlocks,
							states,
							story,
							passageId,
							trace,
							insideLoop
						).join('\n')}`
					: '';
			const code = `<<switch ${visualStateVariable(
				state
			)}>>${cases}${defaultCode}<</switch>>`;
			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(code, condition)));
			return output;
		}

		if (block.kind === 'loop') {
			const state = states.find(item => item.id === block.stateId);

			// A loop iterates a list state; any other state type is skipped.
			if (!state || state.type !== 'list') {
				return output;
			}

			const code = `<<for _item range ${visualStateVariable(
				state
			)}>>${compileBlocks(
				block.blocks,
				states,
				story,
				passageId,
				trace,
				true
			).join('\n')}<</for>>`;
			const condition = block.condition
				? compileExpression(block.condition, states)
				: undefined;

			output.push(mark(withTraceCondition(code, condition)));
			return output;
		}

		// A branch block compiles into a single <<if>> chain. The else branch
		// (condition undefined) must be last; blocks within each branch are
		// compiled recursively with the same passage id.
		if (
			block.branches.length < 2 ||
			block.branches.slice(0, -1).some(branch => !branch.condition) ||
			block.branches[block.branches.length - 1].condition
		) {
			return output;
		}
		const branchConditions = block.branches
			.slice(0, -1)
			.map(branch => compileExpression(branch.condition!, states));

		if (branchConditions.some(condition => condition === undefined)) {
			return output;
		}

		const record = (cond: string | boolean | undefined) =>
			trace
				? `(window.__trace.push({c:${JSON.stringify(
						block.id
					)},r:${cond ?? 'true'}}), ${cond ?? 'true'})`
				: undefined;

		const pieces = block.branches.map((branch, index) => {
			const compiled = compileBlocks(
				branch.blocks,
				states,
				story,
				passageId,
				trace,
				insideLoop
			).join('\n');
			const condition = branchConditions[index];

			const keyword =
				index === 0
					? trace
						? `<<if ${record(condition)}>>`
						: `<<if ${condition}>>`
					: condition
						? trace
							? `<<elseif ${record(condition)}>>`
							: `<<elseif ${condition}>>`
						: '<<else>>';

			return `${keyword}${compiled}`;
		});

		// Branch blocks have no block-level condition (only per-branch ones,
		// recorded above); the whole `<<if>>` chain is wrapped in start/end
		// markers when tracing.
		output.push(mark(`${pieces.join('')}<</if>>`));
		return output;
	}, []);
}

/**
 * Compiles visual passage data into the small SugarCube subset used by the
 * visual editor.
 *
 * State initialization is emitted only when `passageId` is the id of the
 * passage that owns initialization. That owner prefers a real passage named
 * "StoryInit" (which SugarCube runs automatically once at story start); when
 * no StoryInit exists, it falls back to the start passage if it is visual,
 * otherwise the first visual passage, so older stories keep working until
 * their states are next edited (which auto-creates StoryInit). The caller
 * passes the passage id explicitly so that the init block survives edits even
 * when `content` is a freshly created object rather than the passage's stored
 * reference.
 */
export function compileVisualPassage(
	content: VisualPassageContent,
	story: Story,
	passageId?: string,
	options?: {trace?: boolean}
) {
	const contentV2 = migrateVisualContent(content);
	const states = story.visual?.states ?? [];
	const initPassage =
		story.passages.find(passage => passage.name === 'StoryInit') ??
		story.passages.find(
			passage => passage.id === story.startPassage && passage.visual
		) ??
		story.passages.find(passage => passage.visual);
	const initialization =
		passageId && passageId === initPassage?.id
			? compileStateInitialization(states)
			: '';
	const result: string[] = [];

	if (initialization) {
		result.push(initialization);
	}

	result.push(
		...compileBlocks(
			contentV2.blocks,
			states,
			story,
			passageId,
			options?.trace === true
		)
	);

	return result.join('\n\n').trim();
}

export function emptyVisualPassage(): VisualPassageContentV2 {
	return {blocks: [], version: 2};
}

export function passageUsesVisualEditor(
	passage: Passage
): passage is Passage & {visual: VisualPassageContent} {
	return passage.visual?.version === 1 || passage.visual?.version === 2;
}
