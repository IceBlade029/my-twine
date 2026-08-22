import {parse} from 'acorn';
import {VisualExpression, VisualStoryState} from '../store/stories';
import {sanitizeVariableName} from './visual-passage';

/**
 * Walks the structured VisualExpression tree, collecting the id of every
 * story state that is read. When the expression is entirely structured, the
 * result is a complete, deterministic read set.
 */
function walkStructured(
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
		case 'count':
			output.push(expr.variableId);
			return true;
		case 'unary':
			return walkStructured(expr.operand, output);
		case 'binary':
			return (
				walkStructured(expr.left, output) &&
				walkStructured(expr.right, output)
			);
		// A free expression is opaque: analysis falls back to acorn below.
		case 'free':
		default:
			return false;
	}
}

/**
 * Replaces `$name` SugarCube variable references in free code with
 * `State.variables.name` member-access nodes, then parses the result with
 * acorn. Any MemberExpression whose object is `State.variables` with a plain
 * property access is treated as a read of that story state.
 *
 * The replacement is deliberately simple: a regex over `$identifier` (and a
 * bare `_identifier` for loop items, which is ignored). It does not handle
 * bracket access like `State.variables[name]` or aliasing of the State
 * object, so analysis can miss some reads — callers treat that as
 * "unknown" only when parsing itself fails.
 */
export function analyzeExpression(
	expr: VisualExpression,
	states: VisualStoryState[]
): {variableIds: string[]; unknown: boolean} {
	const output: string[] = [];

	if (walkStructured(expr, output)) {
		return {variableIds: output, unknown: false};
	}

	// Only free expressions reach here. Preprocess and parse.
	if (expr.kind !== 'free') {
		return {variableIds: [], unknown: true};
	}

	try {
		const code = expr.code.replace(
			/\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
			'State.variables.$1'
		);
		const ast = parse(code, {ecmaVersion: 'latest'}) as any;

		const reads = new Set<string>();
		const isStateVariables = (node: any) =>
			node &&
			node.type === 'MemberExpression' &&
			!node.computed &&
			node.object &&
			node.object.type === 'Identifier' &&
			node.object.name === 'State' &&
			node.property &&
			node.property.type === 'Identifier' &&
			node.property.name === 'variables';

		// A member read `State.variables.name`, or the target of an
		// assignment/update `State.variables.name = ...`. Writes are reported
		// as reads for now.
		const walk = (node: any) => {
			if (!node || typeof node !== 'object') {
				return;
			}

			if (node.type === 'MemberExpression') {
				if (
					!node.computed &&
					isStateVariables(node.object) &&
					node.property.type === 'Identifier'
				) {
					reads.add(node.property.name);
				}
			}

			for (const key of Object.keys(node)) {
				const value = node[key];

				if (Array.isArray(value)) {
					value.forEach(walk);
				} else if (value && typeof value === 'object' && value.type) {
					walk(value);
				}
			}
		};

		walk(ast);

		// Match collected names back to states by their sanitized variable name.
		const variableIds = states
			.filter(state => reads.has(sanitizeVariableName(state.name)))
			.map(state => state.id);

		return {variableIds, unknown: false};
	} catch {
		// Bad syntax or an unavailable parser: report unknown.
		return {variableIds: [], unknown: true};
	}
}
