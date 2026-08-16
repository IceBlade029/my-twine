import {fakePassage, fakeStory} from '../../test-util';
import {
	VisualBlock,
	VisualPassageContentV1,
	VisualPassageContentV2
} from '../../store/stories';
import {
	compileStateInitialization,
	compileVisualPassage,
	emptyVisualPassage,
	migrateVisualContent,
	passageUsesVisualEditor
} from '../visual-passage';

describe('visual passage utilities', () => {
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
					condition: {operator: 'greaterThan', stateId: state.id, value: 2},
					id: 'text-1',
					kind: 'text',
					text: 'Trusted.'
				},
				{
					actions: [{operation: 'increase', stateId: state.id, value: 1}],
					condition: {operator: 'equals', stateId: state.id, value: 3},
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

		expect(startSource).toContain('<<if ndef $nrp_trust>>');
		expect(startSource).toContain('<<if $nrp_trust gt 2>>Trusted.<</if>>');
		expect(startSource).toContain(
			'<<if $nrp_trust is 3>>[[Continue->Next][$nrp_trust += 1]]<</if>>'
		);

		const nextContent = emptyVisualPassage();

		story.passages[1].visual = nextContent;
		expect(
			compileVisualPassage(
				nextContent,
				story,
				story.passages[1].id
			)
		).not.toContain('<<if ndef $nrp_trust>>');
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
		).toBe('<<print $nrp_trust>>\n\n<<include "Intro">>');
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
							condition: {
								operator: 'greaterThan',
								stateId: state.id,
								value: 5
							},
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
		).toBe('<<if $nrp_trust gt 5>><<print $coins>><</if>>');
	});

	it('compiles loop item variable blocks and keeps state blocks unchanged', () => {
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
		).toBe('<<print _item>>\n\n<<print $nrp_trust>>');
	});

	it('wraps loop item variable blocks in their conditions', () => {
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
							condition: {
								operator: 'greaterThan',
								stateId: state.id,
								value: 1
							},
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
		).toBe('<<if $nrp_trust gt 1>><<print _item>><</if>>');
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
							condition: {
								operator: 'greaterThan',
								stateId: state.id,
								value: 5
							},
							id: 'var-1',
							kind: 'variable',
							stateId: state.id
						},
						{
							condition: {
								operator: 'equals',
								stateId: state.id,
								value: 1
							},
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
			'<<if $nrp_trust gt 5>><<print $nrp_trust>><</if>>\n\n<<if $nrp_trust is 1>><<include "Intro">><</if>>'
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
						condition: {operator: 'equals', stateId: state.id, value: 1},
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
			'<<back "Go back">>\n\n<<if $nrp_trust is 1>><<return "Return">><</if>>'
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
							condition: {
								operator: 'equals',
								stateId: state.id,
								value: true
							},
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
			'<<if $nrp_flag is true>><<link "Reveal">><<replace "#nrp_hook_int_1">>Secret.<</replace>><</link>><span id="#nrp_hook_int_1"></span><</if>>'
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
									condition: {
										operator: 'equals',
										stateId: state.id,
										value: 1
									},
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
			'<<if $nrp_s is 1>>[[Go to A->Ending A]]<<else>>Fallback text.<</if>>'
		);
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
					condition: {operator: 'includes', stateId: state.id, value: 'key'},
					id: 'text-1',
					kind: 'text',
					text: 'You have a key.'
				},
				{
					condition: {
						operator: 'notIncludes',
						stateId: state.id,
						value: 'key'
					},
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
			'<<if ndef $nrp_inv>><<set $nrp_inv = ["a","b"]>><</if>>'
		);
		expect(source).toContain(
			'<<if $nrp_inv.includes("key")>>You have a key.<</if>>'
		);
		expect(source).toContain(
			'<<if !$nrp_inv.includes("key")>>No key.<</if>>'
		);
		// List actions inside a choice setter, in order.
		expect(source).toContain(
			'[[Continue->Next][$nrp_inv.push("key"); $nrp_inv.delete("key"); $nrp_inv = []]]'
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
		).toContain('<<if ndef $nrp_trust>>');

		// A non-owner passage id must not emit initialization.
		expect(
			compileVisualPassage(fresh, story, story.passages[1].id)
		).not.toContain('<<if ndef $nrp_trust>>');
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
		// The start passage (passages[0]) is visual, but a real StoryInit
		// passage exists: it must win ownership of the init block.
		story.passages[0].visual = emptyVisualPassage();
		story.passages[1].visual = emptyVisualPassage();
		story.passages[1].name = 'StoryInit';
		story.passages[2].name = 'Other';

		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).toContain('<<if ndef $nrp_trust>>');

		// The start passage no longer owns initialization when StoryInit exists.
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[0].id)
		).not.toContain('<<if ndef $nrp_trust>>');
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

		// No StoryInit: the start passage (passages[0], visual) owns the init.
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[0].id)
		).toContain('<<if ndef $nrp_flag>>');
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).not.toContain('<<if ndef $nrp_flag>>');
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
		// passages[0] is the start passage but has no visual content.
		story.passages[0].visual = undefined;
		story.passages[1].visual = emptyVisualPassage();
		story.passages[2].visual = emptyVisualPassage();

		// The first visual passage owns initialization.
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[1].id)
		).toContain('<<if ndef $nrp_trust>>');
		expect(
			compileVisualPassage(emptyVisualPassage(), story, story.passages[2].id)
		).not.toContain('<<if ndef $nrp_trust>>');
	});

	it('compiles state initialization into a block and an empty string for no states', () => {
		const state = {
			defaultValue: ['key'],
			id: 'inv',
			name: 'Inventory',
			type: 'list' as const
		};

		expect(compileStateInitialization([state])).toBe(
			'<<if ndef $nrp_inv>><<set $nrp_inv = ["key"]>><</if>>'
		);
		expect(compileStateInitialization([])).toBe('');
	});

	it('migrates v1 content to v2 losslessly and is idempotent', () => {
		const v1: VisualPassageContentV1 = {
			body: 'Hello.',
			bodyCondition: {operator: 'equals', stateId: 's1', value: true},
			choices: [
				{
					actions: [],
					condition: {operator: 'notEquals', stateId: 's1', value: false},
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
			condition: {operator: 'notEquals', stateId: 's1', value: false},
			id: 'choice-1',
			kind: 'choice',
			label: 'Leave',
			targetPassageId: 'passage-2'
		});

		// An empty v1 passage becomes an empty block list.
		expect(migrateVisualContent({body: '', choices: [], version: 1})).toEqual(
			{blocks: [], version: 2}
		);

		// A v1 body without choices still becomes a single text block.
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
			'<<switch $nrp_mood>><<case 1>>Happy.<</case>><<case "red">>Red.<</case>><<case true>>Yes.<</case>><<default>>Unknown.<</default>><</switch>>'
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
							condition: {
								operator: 'equals',
								stateId: state.id,
								value: 1
							},
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
			'<<if $nrp_mood is 1>><<switch $nrp_mood>><<case 1>>[[Leave->Next]]<</case>><</switch>><</if>>'
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
		).toBe('<<for _item range $nrp_inv>>Item:\n<<print _item>><</for>>');
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
							condition: {
								operator: 'includes',
								stateId: state.id,
								value: 'a'
							},
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
			'<<if $nrp_inv.includes("a")>><<for _item range $nrp_inv>>Item.<</for>><</if>>'
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
