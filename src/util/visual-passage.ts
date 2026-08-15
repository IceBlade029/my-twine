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

function sugarCubeValue(value: boolean | number | string) {
	return JSON.stringify(value);
}

function compileCondition(condition: VisualCondition, states: VisualStoryState[]) {
	const state = states.find(item => item.id === condition.stateId);

	if (!state) {
		return undefined;
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
			const target = story.passages.find(
				passage => passage.id === block.targetPassageId
			);
			const label = block.label.trim();

			if (!target || !label) {
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
 * passage that owns initialization (the start passage if it is visual,
 * otherwise the first visual passage). The caller passes the passage id
 * explicitly so that the init block survives edits even when `content` is a
 * freshly created object rather than the passage's stored reference.
 */
export function compileVisualPassage(
	content: VisualPassageContent,
	story: Story,
	passageId?: string
) {
	const contentV2 = migrateVisualContent(content);
	const states = story.visual?.states ?? [];
	const initializationOwner =
		story.passages.find(
			passage => passage.id === story.startPassage && passage.visual
		) ?? story.passages.find(passage => passage.visual);
	const initialization =
		passageId && passageId === initializationOwner?.id
			? states.map(
					state =>
						`<<if ndef ${visualStateVariable(state.id)}>><<set ${visualStateVariable(
							state.id
						)} = ${sugarCubeValue(state.defaultValue)}>><</if>>`
			  )
			: [];
	const result: string[] = [];

	if (initialization.length > 0) {
		result.push(initialization.join('\n'));
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
