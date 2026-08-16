import {VisualStoryState} from '../../store/stories';
import {analyzeExpression} from '../expression-analysis';

const states: VisualStoryState[] = [
	{defaultValue: false, id: 'door', name: 'Door', type: 'boolean'},
	{defaultValue: ['a'], id: 'inv', name: 'Inventory', type: 'list'},
	{defaultValue: 0, id: 'tr1', name: 'Trust 1', type: 'number'}
];

describe('analyzeExpression', () => {
	function variable(variableId: string) {
		return {kind: 'variable' as const, variableId};
	}

	function lit(value: boolean | number | string) {
		return {kind: 'literal' as const, value};
	}

	function binary(operator: any, left: any, right: any) {
		return {kind: 'binary' as const, operator, left, right};
	}

	it('collects variable reads from structured nodes', () => {
		expect(
			analyzeExpression({kind: 'literal', value: 5}, states)
		).toEqual({variableIds: [], unknown: false});
		expect(
			analyzeExpression({kind: 'loopItem'}, states)
		).toEqual({variableIds: [], unknown: false});
		expect(
			analyzeExpression(variable('door'), states)
		).toEqual({variableIds: ['door'], unknown: false});
		expect(
			analyzeExpression(
				binary('==', variable('door'), variable('tr1')),
				states
			)
		).toEqual({variableIds: ['door', 'tr1'], unknown: false});
		// Nested binary and unary.
		expect(
			analyzeExpression(
				{
					kind: 'unary',
					operator: '!',
					operand: binary('>', variable('tr1'), lit(0))
				},
				states
			)
		).toEqual({variableIds: ['tr1'], unknown: false});
	});

	it('analyzes free expressions with $name reads', () => {
		// $Trust_1 matches the 'Trust 1' state via its sanitized name.
		expect(
			analyzeExpression({kind: 'free', code: '$Trust_1 >= 3'}, states)
		).toEqual({variableIds: ['tr1'], unknown: false});

		// $Door reads the boolean state.
		expect(
			analyzeExpression({kind: 'free', code: '$Door && $Inventory'}, states)
		).toEqual({variableIds: ['door', 'inv'], unknown: false});

		// Assignment targets are reported as reads too.
		expect(
			analyzeExpression({kind: 'free', code: '$Inventory = ["x"]'}, states)
		).toEqual({variableIds: ['inv'], unknown: false});
	});

	it('matches collected names back to states by sanitized name', () => {
		// 'Trust 1' sanitizes to Trust_1; a free expression referencing it.
		expect(
			analyzeExpression({kind: 'free', code: '$Trust_1'}, states)
		).toEqual({variableIds: ['tr1'], unknown: false});
	});

	it('returns unknown for free expressions that fail to parse', () => {
		expect(
			analyzeExpression({kind: 'free', code: '1 2'}, states)
		).toEqual({variableIds: [], unknown: true});
		expect(
			analyzeExpression({kind: 'free', code: '('}, states)
		).toEqual({variableIds: [], unknown: true});
	});
});
