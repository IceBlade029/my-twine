import {fakePassage, fakeStory} from '../../test-util';
import {
	VisualBinaryOperator,
	VisualBlock,
	VisualPassageContentV1,
	VisualPassageContentV2
} from '../../store/stories';
import {
	compileExpression,
	compileStateInitialization,
	compileVisualPassage,
	emptyVisualPassage,
	migrateVisualContent,
	passageUsesVisualEditor,
	sanitizeVariableName
} from '../visual-passage';

describe('visual passage utilities', () => {
	function bin(
		variableId: string,
		operator: VisualBinaryOperator,
		value: boolean | number | string
	) {
		return {
			kind: 'binary' as const,
			operator,
			left: {kind: 'variable' as const, variableId},
			right: {kind: 'literal' as const, value}
		};
	}

	it('creates empty visual passage content', () => {
		expect(emptyVisualPassage()).toEqual({blocks: [], version: 2});
	});

	it('compiles text and complete choices into SugarCube source', () => {
		const story = fakeStory(2);

		story.passages[0].name = 'Start';
		story.passages[1].name = 'Hallway';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'text-1', kind: 'text', text: 'A quiet room.'},
						{
							actions: [],
							id: 'choice-1',
							kind: 'choice',
							label: 'Leave',
							targetPassageId: story.passages[1].id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('A quiet room.\n\n[[Leave->Hallway]]');
	});

	it('does not compile incomplete choices or empty text', () => {
		const story = fakeStory(1);

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'text-1', kind: 'text', text: '   '},
						{
							actions: [],
							id: 'choice-1',
							kind: 'choice',
							label: '',
							targetPassageId: story.passages[0].id
						},
						{
							actions: [],
							id: 'choice-2',
							kind: 'choice',
							label: 'Leave',
							targetPassageId: ''
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('detects visual and source passages', () => {
		expect(
			passageUsesVisualEditor(
				fakePassage({visual: {blocks: [], version: 2}})
			)
		).toBe(true);
		expect(
			passageUsesVisualEditor(
				fakePassage({visual: {body: '', choices: [], version: 1}})
			)
		).toBe(true);
		expect(passageUsesVisualEditor(fakePassage({visual: undefined}))).toBe(
			false
		);
	});

	it('sanitizes author-chosen state names into SugarCube variables', () => {
		expect(sanitizeVariableName('Trust')).toBe('Trust');
		expect(sanitizeVariableName('Player 1')).toBe('Player_1');
		expect(sanitizeVariableName('has-died?')).toBe('has_died_');
		expect(sanitizeVariableName('')).toBe('variable');
		expect(sanitizeVariableName('   ')).toBe('___');
		expect(sanitizeVariableName('1up')).toBe('_1up');
		expect(sanitizeVariableName('already_ok_2')).toBe('already_ok_2');
	});

	it('compiles state initialization, conditions, and actions', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: bin(state.id, '>', 2),
					id: 'text-1',
					kind: 'text',
					text: 'Trusted.'
				},
				{
					actions: [{operation: 'increase', stateId: state.id, value: 1}],
					condition: bin(state.id, '==', 3),
					id: 'choice-1',
					kind: 'choice',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].visual = content;
		const startSource = compileVisualPassage(
			content,
			story,
			story.passages[0].id
		);

		expect(startSource).toContain('<<if ndef $Trust>>');
		expect(startSource).toContain('<<if ($Trust > 2)>>Trusted.<</if>>');
		expect(startSource).toContain(
			'<<if ($Trust == 3)>>[[Continue->Next][$Trust += 1]]<</if>>'
		);

		const nextContent = emptyVisualPassage();

		story.passages[1].visual = nextContent;
		expect(
			compileVisualPassage(
				nextContent,
				story,
				story.passages[1].id
			)
		).not.toContain('<<if ndef $Trust>>');
	});

	it('compiles advance-time actions into the story time engine call', () => {
		const story = fakeStory(2);

		story.passages[1].name = 'Next';
		// The time-system action needs no story states at all.
		story.visual = {states: [], version: 1};
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					actions: [
						{operation: 'advanceTime', stateId: '', value: 2},
						{operation: 'advanceTime', stateId: '', value: 0},
						{operation: 'advanceTime', stateId: '', value: 'x'}
					],
					id: 'choice-1',
					kind: 'choice',
					label: 'Sleep',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};

		// Valid step counts are passed through; a zero or non-numeric value
		// falls back to a single step.
		expect(
			compileVisualPassage(content, story, story.passages[0].id)
		).toBe(
			'[[Sleep->Next][setup.time.advance(2); setup.time.advance(1); setup.time.advance(1)]]'
		);
	});

	it('compiles count comparisons of list items', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: [],
			id: 'bp',
			name: 'backpack',
			type: 'list' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: {
						kind: 'binary',
						operator: '>=',
						left: {kind: 'count', variableId: state.id, value: '药草'},
						right: {kind: 'literal', value: 2}
					},
					id: 'choice-1',
					kind: 'choice',
					actions: [],
					label: '合成木弓',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};

		expect(
			compileVisualPassage(content, story, story.passages[0].id)
		).toContain(
			'<<if (($backpack).count("药草") >= 2)>>[[合成木弓->Next]]<</if>>'
		);
	});

	it('does not compile count comparisons on non-list states', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: {
						kind: 'binary',
						operator: '>=',
						left: {kind: 'count', variableId: state.id, value: '药草'},
						right: {kind: 'literal', value: 2}
					},
					id: 'choice-1',
					kind: 'choice',
					actions: [],
					label: '合成木弓',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};

		// The count cannot compile on a non-list state: the condition is
		// silently dropped (mirroring other un-compilable conditions), so the
		// link renders without a gate.
		expect(compileVisualPassage(content, story, story.passages[0].id)).toBe(
			'[[合成木弓->Next]]'
		);
	});

	it('compiles return-main blocks into capture and a dynamic link', () => {
		const story = fakeStory(1);
		const content: VisualPassageContentV2 = {
			blocks: [
				{id: 'rm-1', kind: 'returnMain', label: '回去主流程'}
			],
			version: 2
		};

		expect(
			compileVisualPassage(content, story, story.passages[0].id)
		).toBe(
			'<<if State.length > 1 and not Story.get(State.history[State.length - 2].title).tags.includes("noreturn")>><<set $return = State.history[State.length - 2].title>><</if>><<link "回去主流程" $return>><</link>>'
		);
	});

	it('gates return-main blocks in their conditions and skips empty labels', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: false,
			id: 'menu-open',
			name: 'Menu open',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: {
						kind: 'binary',
						operator: '==',
						left: {kind: 'variable', variableId: state.id},
						right: {kind: 'literal', value: true}
					},
					id: 'rm-1',
					kind: 'returnMain',
					label: '回去'
				},
				{id: 'rm-2', kind: 'returnMain', label: '   '}
			],
			version: 2
		};

		expect(
			compileVisualPassage(content, story, story.passages[0].id)
		).toBe(
			'<<if ($Menu_open == true)>><<if State.length > 1 and not Story.get(State.history[State.length - 2].title).tags.includes("noreturn")>><<set $return = State.history[State.length - 2].title>><</if>><<link "回去" $return>><</link>><</if>>'
		);
	});

	it('compiles expression nodes across all operators', () => {
		const states = [
			{defaultValue: 0, id: 'trust', name: 'Trust', type: 'number' as const},
			{defaultValue: [], id: 'inv', name: 'Inventory', type: 'list' as const}
		];
		const v = (id: string) => ({kind: 'variable' as const, variableId: id});
		const lit = (value: boolean | number | string) => ({
			kind: 'literal' as const,
			value
		});
		const b =
			(op: VisualBinaryOperator) =>
			(left: any, right: any) => ({
				kind: 'binary' as const,
				operator: op,
				left,
				right
			});

		expect(compileExpression(lit(true), states)).toBe('true');
		expect(compileExpression(lit(3), states)).toBe('3');
		expect(compileExpression(lit('cd'), states)).toBe('"cd"');
		expect(compileExpression({kind: 'loopItem'}, states)).toBe('_item');
		expect(compileExpression({kind: 'free', code: '$x >= 1 && $y'}, states)).toBe(
			'$x >= 1 && $y'
		);
		expect(compileExpression({kind: 'free', code: '   '}, states)).toBeUndefined();
		expect(compileExpression(v('trust'), states)).toBe('$Trust');
		// A missing state variable makes the whole expression undefined.
		expect(compileExpression(v('gone'), states)).toBeUndefined();

		expect(compileExpression(b('==') (v('trust'), lit(5)), states)).toBe(
			'($Trust == 5)'
		);
		expect(compileExpression(b('!=') (v('trust'), lit(5)), states)).toBe(
			'($Trust != 5)'
		);
		expect(compileExpression(b('>') (v('trust'), lit(5)), states)).toBe(
			'($Trust > 5)'
		);
		expect(compileExpression(b('>=') (v('trust'), lit(5)), states)).toBe(
			'($Trust >= 5)'
		);
		expect(compileExpression(b('<') (v('trust'), lit(5)), states)).toBe(
			'($Trust < 5)'
		);
		expect(compileExpression(b('<=') (v('trust'), lit(5)), states)).toBe(
			'($Trust <= 5)'
		);
		expect(compileExpression(b('&&') (v('trust'), v('trust')), states)).toBe(
			'($Trust && $Trust)'
		);
		expect(compileExpression(b('||') (v('trust'), v('trust')), states)).toBe(
			'($Trust || $Trust)'
		);
		expect(compileExpression(b('+') (v('trust'), v('trust')), states)).toBe(
			'($Trust + $Trust)'
		);
		expect(compileExpression(b('-') (v('trust'), v('trust')), states)).toBe(
			'($Trust - $Trust)'
		);
		expect(compileExpression(b('includes') (v('inv'), lit('key')), states)).toBe(
			'($Inventory).includes("key")'
		);
		expect(
			compileExpression(b('notIncludes') (v('inv'), lit('key')), states)
		).toBe('!($Inventory).includes("key")');

		// A missing sub-expression poisons the whole binary expression.
		expect(
			compileExpression(b('==') (v('trust'), v('gone')), states)
		).toBeUndefined();

		// Unary negation.
		expect(
			compileExpression({kind: 'unary', operator: '!', operand: v('trust')}, states)
		).toBe('(!$Trust)');
	});

	it('compiles variable and include blocks', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Intro';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'var-1', kind: 'variable', stateId: state.id},
						{
							id: 'inc-1',
							kind: 'include',
							targetPassageId: story.passages[1].id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('<<print $Trust>>\n\n<<include "Intro">>');
	});

	it('skips variable and include blocks with missing references', () => {
		const story = fakeStory(2);

		story.visual = {states: [], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Intro';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'var-1', kind: 'variable', stateId: 'gone'},
						{id: 'var-2', kind: 'variable', stateId: ''},
						{
							id: 'inc-1',
							kind: 'include',
							targetPassageId: ''
						},
						{
							id: 'inc-2',
							kind: 'include',
							targetPassageId: 'missing-id'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('emits raw block sugar verbatim and skips empty raw blocks', () => {
		const story = fakeStory(1);

		story.visual = {states: [], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{id: 'text-1', kind: 'text', text: 'Hello.'},
						// Leading/trailing whitespace survives: no trimming.
						{id: 'raw-1', kind: 'raw', sugar: '  <<set $x = 1>>  '},
						// Whitespace-only raw blocks are skipped.
						{id: 'raw-2', kind: 'raw', sugar: '   '},
						{id: 'raw-3', kind: 'raw', sugar: ''},
						{id: 'text-2', kind: 'text', text: 'Bye.'}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('Hello.\n\n  <<set $x = 1>>  \n\nBye.');
	});

	it('wraps raw block sugar in its condition', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							condition: bin(state.id, '>', 5),
							id: 'raw-1',
							kind: 'raw',
							sugar: '<<print $coins>>'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('<<if ($Trust > 5)>><<print $coins>><</if>>');
	});

	it('skips loop item variable blocks outside loops and keeps state blocks unchanged', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						// A loop item block has no state id and prints _item.
						{
							id: 'var-1',
							kind: 'variable',
							source: 'loopItem',
							stateId: undefined
						},
						// The state source keeps printing the state variable.
						{id: 'var-2', kind: 'variable', stateId: state.id}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('<<print $Trust>>');
	});

	it('skips conditioned loop item variable blocks outside loops', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							condition: bin(state.id, '>', 1),
							id: 'var-1',
							kind: 'variable',
							source: 'loopItem',
							stateId: undefined
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('wraps variable and include blocks in their conditions', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Intro';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							condition: bin(state.id, '>', 5),
							id: 'var-1',
							kind: 'variable',
							stateId: state.id
						},
						{
							condition: bin(state.id, '==', 1),
							id: 'inc-1',
							kind: 'include',
							targetPassageId: story.passages[1].id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if ($Trust > 5)>><<print $Trust>><</if>>\n\n<<if ($Trust == 1)>><<include "Intro">><</if>>'
		);
	});

	it('compiles back/return choices without a setter', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Hallway';

		const source = compileVisualPassage(
			{
				blocks: [
					{
						actions: [{operation: 'set', stateId: state.id, value: 3}],
						id: 'choice-back',
						kind: 'choice',
						label: 'Go back',
						specialTarget: 'back',
						targetPassageId: story.passages[1].id
					},
					{
						actions: [],
						condition: bin(state.id, '==', 1),
						id: 'choice-return',
						kind: 'choice',
						label: 'Return',
						specialTarget: 'return',
						targetPassageId: story.passages[1].id
					}
				],
				version: 2
			},
			story,
			story.passages[0].id
		);

		// specialTarget ignores the target passage id and the actions: the
		// back/return macros have no setter, and a condition wraps the link.
		expect(source).toBe(
			'<<back "Go back">>\n\n<<if ($Trust == 1)>><<return "Return">><</if>>'
		);
	});

	it('compiles interaction blocks to in-place link macros', () => {
		const story = fakeStory(1);

		story.visual = {states: [], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							content: 'A secret.',
							id: 'int-1',
							kind: 'interaction',
							label: 'Reveal',
							operation: 'reveal'
						},
						{
							content: ' more',
							id: 'int-2',
							kind: 'interaction',
							label: 'Append',
							operation: 'append'
						},
						{
							content: 'Peek.',
							id: 'int-3',
							kind: 'interaction',
							label: 'Remove',
							operation: 'remove'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<link "Reveal">><<replace "#nrp_hook_int_1">>A secret.<</replace>><</link>><span id="#nrp_hook_int_1"></span>\n\n' +
				'<<link "Append">><<append "#nrp_hook_int_2">> more<</append>><</link>><span id="#nrp_hook_int_2"></span>\n\n' +
				'<<link "Remove">><<remove "#nrp_hook_int_3">><</link>><span id="#nrp_hook_int_3">Peek.</span>'
		);
	});

	it('skips interaction blocks with an empty label and sanitizes hook ids', () => {
		const story = fakeStory(1);

		story.visual = {states: [], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							content: 'Hidden.',
							id: 'int-1',
							kind: 'interaction',
							label: '   ',
							operation: 'reveal'
						},
						{
							content: 'Text.',
							id: 'int a.b',
							kind: 'interaction',
							label: 'Show',
							operation: 'reveal'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<link "Show">><<replace "#nrp_hook_int_a_b">>Text.<</replace>><</link>><span id="#nrp_hook_int_a_b"></span>'
		);
	});

	it('wraps interaction blocks in their conditions', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: false,
			id: 'flag',
			name: 'Flag',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							condition: bin(state.id, '==', true),
							content: 'Secret.',
							id: 'int-1',
							kind: 'interaction',
							label: 'Reveal',
							operation: 'reveal'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if ($Flag == true)>><<link "Reveal">><<replace "#nrp_hook_int_1">>Secret.<</replace>><</link>><span id="#nrp_hook_int_1"></span><</if>>'
		);
	});

	it('compiles nested branches with conditions and an else branch', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: 0,
			id: 's',
			name: 'S',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Ending A';
		story.passages[2].name = 'Ending B';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							branches: [
								{
									blocks: [
										{
											actions: [],
											id: 'choice-a',
											kind: 'choice',
											label: 'Go to A',
											targetPassageId: story.passages[1].id
										}
									],
									condition: bin(state.id, '==', 1),
									id: 'branch-a'
								},
								{
									blocks: [
										{id: 'text-b', kind: 'text', text: 'Fallback text.'}
									],
									id: 'branch-else'
								}
							],
							id: 'branch-1',
							kind: 'branch'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if ($S == 1)>>[[Go to A->Ending A]]<<else>>Fallback text.<</if>>'
		);
	});

	it('skips incomplete branches instead of compiling a leading else as true', () => {
		const story = fakeStory(1);

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							branches: [
								{blocks: [{id: 'a', kind: 'text', text: 'A'}], id: 'a'},
								{blocks: [{id: 'b', kind: 'text', text: 'B'}], id: 'b'}
							],
							id: 'branch-1',
							kind: 'branch'
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('compiles list initialization, list actions, and list conditions', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: ['a', 'b'],
			id: 'inv',
			name: 'Inventory',
			type: 'list' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[1].name = 'Next';
		const content: VisualPassageContentV2 = {
			blocks: [
				{
					condition: bin(state.id, 'includes', 'key'),
					id: 'text-1',
					kind: 'text',
					text: 'You have a key.'
				},
				{
					condition: bin(state.id, 'notIncludes', 'key'),
					id: 'text-2',
					kind: 'text',
					text: 'No key.'
				},
				{
					actions: [
						{operation: 'push', stateId: state.id, value: 'key'},
						{operation: 'remove', stateId: state.id, value: 'key'},
						{operation: 'clear', stateId: state.id, value: 'key'}
					],
					id: 'choice-1',
					kind: 'choice',
					label: 'Continue',
					targetPassageId: story.passages[1].id
				}
			],
			version: 2
		};
		story.passages[0].visual = content;
		const source = compileVisualPassage(content, story, story.passages[0].id);

		// The list default initializes as a SugarCube array literal.
		expect(source).toContain(
			'<<if ndef $Inventory>><<set $Inventory = ["a","b"]>><</if>>'
		);
		expect(source).toContain(
			'<<if ($Inventory).includes("key")>>You have a key.<</if>>'
		);
		expect(source).toContain(
			'<<if !($Inventory).includes("key")>>No key.<</if>>'
		);
		// List actions inside a choice setter, in order.
		expect(source).toContain(
			'[[Continue->Next][$Inventory.push("key"); $Inventory.delete("key"); $Inventory = []]]'
		);
	});

	it('emits initialization based on the passage id, not content identity', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		// The owner: the start passage with visual content.
		story.passages[0].visual = emptyVisualPassage();
		story.passages[1].visual = emptyVisualPassage();
		// A freshly created content object that is NOT the stored reference.
		const fresh: VisualPassageContentV2 = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};

		// The fix: initialization is emitted for the owner passage even when the
		// content object was just created.
		expect(
			compileVisualPassage(fresh, story, story.passages[0].id)
		).toContain('<<if ndef $Trust>>');

		// A non-owner passage id must not emit initialization.
		expect(
			compileVisualPassage(fresh, story, story.passages[1].id)
		).not.toContain('<<if ndef $Trust>>');
	});

	it('compiles state initialization into a StoryInit passage when one exists', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].visual = emptyVisualPassage();
		story.passages[1].visual = emptyVisualPassage();
		story.passages[1].name = 'StoryInit';
		story.passages[2].name = 'Other';

		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).toContain('<<if ndef $Trust>>');

		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[0].id)
		).not.toContain('<<if ndef $Trust>>');
	});

	it('falls back to the start passage when it is visual and no StoryInit exists', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: false,
			id: 'flag',
			name: 'Flag',
			type: 'boolean' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].visual = emptyVisualPassage();
		story.passages[1].visual = emptyVisualPassage();

		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[0].id)
		).toContain('<<if ndef $Flag>>');
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).not.toContain('<<if ndef $Flag>>');
	});

	it('falls back to the first visual passage when no StoryInit exists and the start passage is not visual', () => {
		const story = fakeStory(3);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].visual = undefined;
		story.passages[1].visual = emptyVisualPassage();
		story.passages[2].visual = emptyVisualPassage();

		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).toContain('<<if ndef $Trust>>');
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[2].id)
		).not.toContain('<<if ndef $Trust>>');
	});

	it('compiles state initialization into a block and an empty string for no states', () => {
		const states = [
			{
				defaultValue: ['key'],
				id: 'inv',
				name: 'Inventory',
				type: 'list' as const
			},
			{
				defaultValue: 0,
				id: 'p1',
				name: 'Player 1',
				type: 'number' as const
			}
		];

		expect(compileStateInitialization(states)).toBe(
			'<<if ndef $Inventory>><<set $Inventory = ["key"]>><</if>>\n<<if ndef $Player_1>><<set $Player_1 = 0>><</if>>'
		);
		expect(compileStateInitialization([])).toBe('');
	});

	it('compiles set blocks with =, +=, -= and wraps their conditions', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		const compileSet = (set: any) =>
			compileVisualPassage({blocks: [set], version: 2}, story, story.passages[0].id);

		// Plain assignment.
		expect(
			compileSet({
				id: 'set-1',
				kind: 'set',
				operation: '=',
				variableId: state.id,
				value: {kind: 'literal', value: 4}
			})
		).toBe('<<set $Trust = 4>>');

		// Increment.
		expect(
			compileSet({
				id: 'set-2',
				kind: 'set',
				operation: '+=',
				variableId: state.id,
				value: {kind: 'literal', value: 1}
			})
		).toBe('<<set $Trust += 1>>');

		// Decrement.
		expect(
			compileSet({
				id: 'set-3',
				kind: 'set',
				operation: '-=',
				variableId: state.id,
				value: {kind: 'literal', value: 2}
			})
		).toBe('<<set $Trust -= 2>>');

		// A compilable condition wraps the whole set.
		expect(
			compileSet({
				id: 'set-4',
				kind: 'set',
				operation: '=',
				variableId: state.id,
				value: {kind: 'literal', value: 4},
				condition: bin(state.id, '>', 1)
			})
		).toBe('<<if ($Trust > 1)>><<set $Trust = 4>><</if>>');

		// A missing target state skips the block entirely.
		expect(
			compileSet({
				id: 'set-5',
				kind: 'set',
				operation: '=',
				variableId: 'gone',
				value: {kind: 'literal', value: 4}
			})
		).toBe('');

		// A missing value sub-expression also skips it.
		expect(
			compileSet({
				id: 'set-6',
				kind: 'set',
				operation: '=',
				variableId: state.id,
				value: {kind: 'binary', operator: '+', left: {kind: 'variable', variableId: 'gone'}, right: {kind: 'literal', value: 1}}
			})
		).toBe('');

		// A non-compilable condition still emits the block body unwrapped.
		expect(
			compileSet({
				id: 'set-7',
				kind: 'set',
				operation: '=',
				variableId: state.id,
				value: {kind: 'literal', value: 4},
				condition: bin('gone', '==', 1)
			})
		).toBe('<<set $Trust = 4>>');

		// A loop item is not in scope at passage level.
		expect(
			compileSet({
				id: 'set-8',
				kind: 'set',
				operation: '=',
				variableId: state.id,
				value: {kind: 'loopItem'}
			})
		).toBe('');

		// Numeric operators are rejected for non-number targets.
		const textState = {
			defaultValue: 'hello',
			id: 'title',
			name: 'Title',
			type: 'text' as const
		};
		story.visual = {states: [state, textState], version: 1};
		expect(
			compileSet({
				id: 'set-9',
				kind: 'set',
				operation: '+=',
				variableId: textState.id,
				value: {kind: 'literal', value: ' world'}
			})
		).toBe('');
	});

	it('migrates v1 content to v2 losslessly', () => {
		const v1: VisualPassageContentV1 = {
			body: 'Hello.',
			bodyCondition: {
				kind: 'binary',
				operator: '==',
				left: {kind: 'variable', variableId: 's1'},
				right: {kind: 'literal', value: true}
			},
			choices: [
				{
					actions: [],
					condition: {
						kind: 'binary',
						operator: '!=',
						left: {kind: 'variable', variableId: 's1'},
						right: {kind: 'literal', value: false}
					},
					id: 'choice-1',
					label: 'Leave',
					targetPassageId: 'passage-2'
				}
			],
			version: 1
		};
		const migrated = migrateVisualContent(v1);

		expect(migrated.version).toBe(2);
		expect(migrated.blocks).toHaveLength(2);
		expect(migrated.blocks[0]).toMatchObject({
			condition: v1.bodyCondition,
			kind: 'text',
			text: 'Hello.'
		});
		expect(migrated.blocks[1]).toEqual({
			actions: [],
			condition: {
				kind: 'binary',
				operator: '!=',
				left: {kind: 'variable', variableId: 's1'},
				right: {kind: 'literal', value: false}
			},
			id: 'choice-1',
			kind: 'choice',
			label: 'Leave',
			targetPassageId: 'passage-2'
		});

		expect(migrateVisualContent({body: '', choices: [], version: 1})).toEqual(
			{blocks: [], version: 2}
		);
		expect(
			migrateVisualContent({body: 'Only text.', choices: [], version: 1})
				.blocks
		).toMatchObject([
			{condition: undefined, kind: 'text', text: 'Only text.'}
		]);
	});

	it('returns v2 content unchanged from migration', () => {
		const v2: VisualPassageContentV2 = {
			blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}],
			version: 2
		};

		expect(migrateVisualContent(v2)).toBe(v2);
	});

	it('compiles switch blocks with string, boolean, and number cases plus a default', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'mood',
			name: 'Mood',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							cases: [
								{
									blocks: [{id: 'text-1', kind: 'text', text: 'Happy.'}],
									id: 'case-1',
									value: 1
								},
								{
									blocks: [{id: 'text-2', kind: 'text', text: 'Red.'}],
									id: 'case-2',
									value: 'red'
								},
								{
									blocks: [{id: 'text-3', kind: 'text', text: 'Yes.'}],
									id: 'case-3',
									value: true
								}
							],
							defaultBlocks: [
								{id: 'text-4', kind: 'text', text: 'Unknown.'}
							],
							id: 'switch-1',
							kind: 'switch',
							stateId: state.id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<switch $Mood>><<case 1>>Happy.<<case "red">>Red.<<case true>>Yes.<<default>>Unknown.<</switch>>'
		);
	});

	it('wraps switch blocks in their conditions and compiles nested blocks', () => {
		const story = fakeStory(2);
		const state = {
			defaultValue: 0,
			id: 'mood',
			name: 'Mood',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';
		story.passages[1].name = 'Next';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							cases: [
								{
									blocks: [
										{
											actions: [],
											id: 'choice-1',
											kind: 'choice',
											label: 'Leave',
											targetPassageId: story.passages[1].id
										}
									],
									id: 'case-1',
									value: 1
								}
							],
							condition: bin(state.id, '==', 1),
							defaultBlocks: [],
							id: 'switch-1',
							kind: 'switch',
							stateId: state.id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if ($Mood == 1)>><<switch $Mood>><<case 1>>[[Leave->Next]]<</switch>><</if>>'
		);
	});

	it('skips switch blocks with a missing state or no cases and no default', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: 0,
			id: 'mood',
			name: 'Mood',
			type: 'number' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							cases: [{blocks: [], id: 'case-1', value: 1}],
							defaultBlocks: [{id: 'text-1', kind: 'text', text: 'D.'}],
							id: 'switch-1',
							kind: 'switch',
							stateId: 'gone'
						},
						{
							cases: [],
							defaultBlocks: [],
							id: 'switch-2',
							kind: 'switch',
							stateId: state.id
						},
						{
							cases: [],
							defaultBlocks: [],
							id: 'switch-3',
							kind: 'switch',
							stateId: ''
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});

	it('compiles loop blocks over list states with a nested body', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: ['a', 'b'],
			id: 'inv',
			name: 'Inventory',
			type: 'list' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							blocks: [
								{id: 'text-1', kind: 'text', text: 'Item: '},
								{
									id: 'var-1',
									kind: 'variable',
									source: 'loopItem',
									stateId: undefined
								}
							],
							id: 'loop-1',
							kind: 'loop',
							stateId: state.id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('<<for _item range $Inventory>>Item:\n<<print _item>><</for>>');
	});

	it('wraps loop blocks in their conditions', () => {
		const story = fakeStory(1);
		const state = {
			defaultValue: ['a'],
			id: 'inv',
			name: 'Inventory',
			type: 'list' as const
		};

		story.visual = {states: [state], version: 1};
		story.passages[0].name = 'Start';

		expect(
			compileVisualPassage(
				{
					blocks: [
						{
							blocks: [{id: 'text-1', kind: 'text', text: 'Item.'}],
							condition: bin(state.id, 'includes', 'a'),
							id: 'loop-1',
							kind: 'loop',
							stateId: state.id
						}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe(
			'<<if ($Inventory).includes("a")>><<for _item range $Inventory>>Item.<</for>><</if>>'
		);
	});

	it('skips loop blocks with a missing state or a non-list state', () => {
		const story = fakeStory(1);
		const numberState = {
			defaultValue: 0,
			id: 'trust',
			name: 'Trust',
			type: 'number' as const
		};

		story.visual = {states: [numberState], version: 1};
		story.passages[0].name = 'Start';
		const body: VisualBlock[] = [{id: 'text-1', kind: 'text', text: 'Item.'}];

		expect(
			compileVisualPassage(
				{
					blocks: [
						{blocks: body, id: 'loop-1', kind: 'loop', stateId: 'gone'},
						{
							blocks: body,
							id: 'loop-2',
							kind: 'loop',
							stateId: numberState.id
						},
						{blocks: body, id: 'loop-3', kind: 'loop', stateId: ''}
					],
					version: 2
				},
				story,
				story.passages[0].id
			)
		).toBe('');
	});
});

describe('trace mode (P3)', () => {
	const state = {
		defaultValue: 0,
		id: 'trust',
		name: 'Trust',
		type: 'number' as const
	};

	function tracedStory() {
		const story = fakeStory(2);

		story.passages[0].name = 'Start';
		story.passages[1].name = 'Hallway';
		story.visual = {states: [state], version: 1};

		return story;
	}

	it('wraps unprefixed blocks with start/end markers only in trace mode', () => {
		const story = tracedStory();
		const plain = compileVisualPassage(
			{blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}], version: 2},
			story,
			story.passages[0].id
		);
		const traced = compileVisualPassage(
			{blocks: [{id: 'text-1', kind: 'text', text: 'Hello.'}], version: 2},
			story,
			story.passages[0].id,
			{trace: true}
		);

		// Non-trace output is untouched.
		expect(plain).toBe('Hello.');
		// Trace mode wraps the block with start and end markers.
		expect(traced).toBe(
			'<<script>>window.__trace.push({b:"text-1",ev:"s"})<</script>>Hello.' +
				'<<script>>window.__trace.push({b:"text-1",ev:"e"})<</script>>'
		);
	});

	it('records evaluated conditions on gated blocks', () => {
		const story = tracedStory();
		const traced = compileVisualPassage(
			{
				blocks: [
					{
						condition: {
							kind: 'binary',
							operator: '>',
							left: {kind: 'variable', variableId: state.id},
							right: {kind: 'literal', value: 5}
						},
						id: 'text-1',
						kind: 'text',
						text: 'High.'
					}
				],
				version: 2
			},
			story,
			story.passages[0].id,
			{trace: true}
		);

		expect(traced).toContain(
			'<<if (window.__trace.push({c:"text-1",r:($Trust > 5)}), ($Trust > 5))>>'
		);
		expect(traced).toContain('<<script>>window.__trace.push({b:"text-1",ev:"s"})<</script>>');
		expect(traced).toContain('<<script>>window.__trace.push({b:"text-1",ev:"e"})<</script>>');
	});

	it('records branch conditions per branch', () => {
		const story = tracedStory();
		const traced = compileVisualPassage(
			{
				blocks: [
					{
						branches: [
							{
								blocks: [{id: 't1', kind: 'text', text: 'A'}],
								condition: {
									kind: 'binary',
									operator: '==',
									left: {kind: 'variable', variableId: state.id},
									right: {kind: 'literal', value: 1}
								},
								id: 'b1'
							},
							{blocks: [{id: 't2', kind: 'text', text: 'B'}], id: 'b2'}
						],
						id: 'branch-1',
						kind: 'branch'
					}
				],
				version: 2
			},
			story,
			story.passages[0].id,
			{trace: true}
		);

		expect(traced).toContain(
			'<<if (window.__trace.push({c:"branch-1",r:($Trust == 1)}), ($Trust == 1))>>'
		);
		expect(traced).toContain('<<else>>');
		expect(traced).toContain('<<script>>window.__trace.push({b:"branch-1",ev:"s"})<</script>>');
		expect(traced).toContain('<<script>>window.__trace.push({b:"branch-1",ev:"e"})<</script>>');
	});

	it('keeps nested blocks traced inside loops and switches', () => {
		const listState = {
			defaultValue: ['a'],
			id: 'inv',
			name: 'Inventory',
			type: 'list' as const
		};
		const story = fakeStory(1);

		story.passages[0].name = 'Start';
		story.visual = {states: [listState], version: 1};
		const traced = compileVisualPassage(
			{
				blocks: [
					{
						blocks: [{id: 'inner', kind: 'text', text: 'Item.'}],
						id: 'loop-1',
						kind: 'loop',
						stateId: listState.id
					}
				],
				version: 2
			},
			story,
			story.passages[0].id,
			{trace: true}
		);

		expect(traced).toContain(
			'<<script>>window.__trace.push({b:"inner",ev:"s"})<</script>>'
		);
		expect(traced).toContain(
			'<<script>>window.__trace.push({b:"inner",ev:"e"})<</script>>'
		);
	});
});
