import {v4 as uuid} from '@lukeed/uuid';
import {
	Passage,
	Story,
	VisualBlock,
	VisualCondition,
	VisualPassageContent,
	VisualPassageContentV2,
	VisualStateAction,
	VisualStoryState
} from '../store/stories';

export function visualStateVariable(stateId: string) {
	return `$nrp_${stateId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
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
				`<<if ndef ${visualStateVariable(state.id)}>><<set ${visualStateVariable(
					state.id
				)} = ${sugarCubeValue(state.defaultValue)}>><</if>>`
		)
		.join('\n');
}

function compileCondition(condition: VisualCondition, states: VisualStoryState[]) {
	const state = states.find(item => item.id === condition.stateId);

	if (!state) {
		return undefined;
	}

	if (condition.operator === 'includes') {
		return `${visualStateVariable(state.id)}.includes(${sugarCubeValue(condition.value)})`;
	}

	if (condition.operator === 'notIncludes') {
		return `!${visualStateVariable(state.id)}.includes(${sugarCubeValue(condition.value)})`;
	}

	const operators = {
		equals: 'is',
		notEquals: 'isnot',
		greaterThan: 'gt',
		lessThan: 'lt'
	};

	return `${visualStateVariable(state.id)} ${operators[condition.operator]} ${sugarCubeValue(condition.value)}`;
}

function compileAction(action: VisualStateAction, states: VisualStoryState[]) {
	const state = states.find(item => item.id === action.stateId);

	if (!state) {
		return undefined;
	}

	const variable = visualStateVariable(state.id);

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
	passageId?: string
): string[] {
	return blocks.reduce<string[]>((output, block) => {
		if (block.kind === 'text') {
			const text = block.text.trim();

			if (!text && !block.condition) {
				return output;
			}

			const condition = block.condition
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${text}<</if>>` : text);
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
					? compileCondition(block.condition, states)
					: undefined;

				output.push(condition ? `<<if ${condition}>>${link}<</if>>` : link);
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
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${link}<</if>>` : link);
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
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
			return output;
		}

		if (block.kind === 'raw') {
			// Skip whitespace-only blocks, but emit the sugar verbatim once it
			// has content: no trimming of the actual source.
			if (block.sugar.trim() === '') {
				return output;
			}

			const condition = block.condition
				? compileCondition(block.condition, states)
				: undefined;

			output.push(
				condition ? `<<if ${condition}>>${block.sugar}<</if>>` : block.sugar
			);
			return output;
		}

		if (block.kind === 'variable') {
			if (block.source === 'loopItem') {
				const code = '<<print _item>>';
				const condition = block.condition
					? compileCondition(block.condition, states)
					: undefined;

				output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
				return output;
			}

			const state = states.find(item => item.id === block.stateId);

			if (!state) {
				return output;
			}

			const code = `<<print ${visualStateVariable(state.id)}>>`;
			const condition = block.condition
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
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
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
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
							passageId
						).join('\n')}<</case>>`
				)
				.join('');
			const defaultCode =
				block.defaultBlocks.length > 0
					? `<<default>>${compileBlocks(
							block.defaultBlocks,
							states,
							story,
							passageId
						).join('\n')}<</default>>`
					: '';
			const code = `<<switch ${visualStateVariable(
				state.id
			)}>>${cases}${defaultCode}<</switch>>`;
			const condition = block.condition
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
			return output;
		}

		if (block.kind === 'loop') {
			const state = states.find(item => item.id === block.stateId);

			// A loop iterates a list state; any other state type is skipped.
			if (!state || state.type !== 'list') {
				return output;
			}

			const code = `<<for _item range ${visualStateVariable(
				state.id
			)}>>${compileBlocks(block.blocks, states, story, passageId).join(
				'\n'
			)}<</for>>`;
			const condition = block.condition
				? compileCondition(block.condition, states)
				: undefined;

			output.push(condition ? `<<if ${condition}>>${code}<</if>>` : code);
			return output;
		}

		// A branch block compiles into a single <<if>> chain. The else branch
		// (condition undefined) must be last; blocks within each branch are
		// compiled recursively with the same passage id.
		const pieces = block.branches.map((branch, index) => {
			const compiled = compileBlocks(
				branch.blocks,
				states,
				story,
				passageId
			).join('\n');
			const condition = branch.condition
				? compileCondition(branch.condition, states)
				: undefined;

			// Defensive: a leading conditionless branch is invalid per the data
			// model (the editor creates such blocks before the user picks a
			// condition), so treat it as always-true rather than emitting an
			// invalid `<<else>>` first.
			const keyword =
				index === 0
					? condition
						? `<<if ${condition}>>`
						: '<<if 1>>'
					: condition
						? `<<elseif ${condition}>>`
						: '<<else>>';

			return `${keyword}${compiled}`;
		});

		output.push(`${pieces.join('')}<</if>>`);
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
	passageId?: string
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

	result.push(...compileBlocks(contentV2.blocks, states, story, passageId));

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
