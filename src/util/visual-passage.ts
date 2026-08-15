import {
	Passage,
	Story,
	VisualCondition,
	VisualPassageContentV1,
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
 * Compiles visual passage data into the small SugarCube subset used by the
 * first visual editor iteration.
 */
export function compileVisualPassage(
	content: VisualPassageContentV1,
	story: Story
) {
	const result: string[] = [];
	const body = content.body.trim();
	const states = story.visual?.states ?? [];
	const owner = story.passages.find(passage => passage.visual === content);
	const initializationOwner =
		story.passages.find(
			passage => passage.id === story.startPassage && passage.visual
		) ?? story.passages.find(passage => passage.visual);
	const initialization = owner?.id === initializationOwner?.id ? states.map(
		state =>
			`<<if ndef ${visualStateVariable(state.id)}>><<set ${visualStateVariable(
				state.id
			)} = ${sugarCubeValue(state.defaultValue)}>><</if>>`
	) : [];

	if (initialization.length > 0) {
		result.push(initialization.join('\n'));
	}

	if (body) {
		const condition = content.bodyCondition
			? compileCondition(content.bodyCondition, states)
			: undefined;

		result.push(condition ? `<<if ${condition}>>\n${body}\n<</if>>` : body);
	}

	const choices = content.choices.reduce<string[]>((output, choice) => {
		const target = story.passages.find(
			passage => passage.id === choice.targetPassageId
		);
		const label = choice.label.trim();

		if (!target || !label) {
			return output;
		}

		const actions = (choice.actions ?? [])
			.map(action => compileAction(action, states))
			.filter((action): action is string => Boolean(action));
		const setter = actions.length > 0 ? `[${actions.join('; ')}]` : '';
		const link = `[[${label}->${target.name}]${setter}]`;
		const condition = choice.condition
			? compileCondition(choice.condition, states)
			: undefined;

		return [
			...output,
			condition ? `<<if ${condition}>>${link}<</if>>` : link
		];
	}, []);

	if (choices.length > 0) {
		result.push(choices.join('\n'));
	}

	return result.join('\n\n');
}

export function emptyVisualPassage(): VisualPassageContentV1 {
	return {body: '', choices: [], version: 1};
}

export function passageUsesVisualEditor(
	passage: Passage
): passage is Passage & {visual: VisualPassageContentV1} {
	return passage.visual?.version === 1;
}
