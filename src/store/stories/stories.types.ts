import {Thunk} from 'react-hook-thunk-reducer';
import {Color} from '../../util/color';
import {StoryFormat} from '../story-formats/story-formats.types';

/**
 * A single passage in a story.
 */
export interface Passage {
	/**
	 * Height of the passage in pixels.
	 */
	height: number;
	/**
	 * Should the passage be drawn highlighted?
	 */
	highlighted: boolean;
	/**
	 * GUID identifying the passage.
	 */
	id: string;
	/**
	 * Left (e.g. X) position of the top-left corner of the passage in pixels.
	 */
	left: number;
	/**
	 * Name of the passage.
	 */
	name: string;
	/**
	 * Is the passage currently selected by the user?
	 */
	selected: boolean;
	/**
	 * ID of the parent story.
	 */
	story: string;
	/**
	 * Passage tags.
	 */
	tags: string[];
	/**
	 * Body text of the passage.
	 */
	text: string;
	/**
	 * Structured authoring data used by the visual passage editor. If absent,
	 * the passage is edited as SugarCube source.
	 */
	visual?: VisualPassageContent;
	/**
	 * Top (e.g. Y) position of the top-left corner of the passage in pixels.
	 */
	top: number;
	/**
	 * Width of the passage in pixels.
	 */
	width: number;
}

export interface VisualPassageChoice {
	/** Stable editor-only identifier. */
	id: string;
	/** Text shown to the player. */
	label: string;
	/** Target passage ID. An empty value means the choice is incomplete. */
	targetPassageId: string;
	condition?: VisualExpression;
	actions: VisualStateAction[];
}

export interface VisualPassageContentV1 {
	/** Plain passage body. SugarCube source is generated from this data. */
	body: string;
	bodyCondition?: VisualExpression;
	choices: VisualPassageChoice[];
	version: 1;
}

/**
 * An ordered tree of blocks that make up a visually authored passage.
 */
export type VisualPassageContent = VisualPassageContentV1 | VisualPassageContentV2;

export interface VisualPassageContentV2 {
	blocks: VisualBlock[];
	version: 2;
}

export type VisualBlock =
	| VisualTextBlock
	| VisualChoiceBlock
	| VisualInteractionBlock
	| VisualVariableBlock
	| VisualSetBlock
	| VisualRawBlock
	| VisualIncludeBlock
	| VisualBranchBlock
	| VisualSwitchBlock
	| VisualLoopBlock;

export interface VisualTextBlock {
	kind: 'text';
	id: string;
	text: string;
	condition?: VisualExpression;
}

export interface VisualChoiceBlock {
	kind: 'choice';
	id: string;
	label: string;
	targetPassageId: string; // '' means incomplete
	/**
	 * When set, the choice navigates back/return instead of to
	 * targetPassageId. The target passage id is ignored while set.
	 */
	specialTarget?: 'back' | 'return';
	condition?: VisualExpression;
	actions: VisualStateAction[];
}

export interface VisualInteractionBlock {
	kind: 'interaction';
	id: string;
	/** Text shown on the link. An empty value means the block is incomplete. */
	label: string;
	/** How clicking the link changes the hook element's content. */
	operation: 'reveal' | 'append' | 'remove';
	/** Content shown, appended, or initially present in the hook element. */
	content: string;
	condition?: VisualExpression;
}

export interface VisualVariableBlock {
	kind: 'variable';
	id: string;
	/**
	 * What the block prints: a story state value ('state', the default) or the
	 * current loop item ('loopItem', to be used inside a loop block). A
	 * loopItem block has no state, so stateId is undefined for it.
	 */
	source?: 'state' | 'loopItem';
	/** Story state whose value is printed. An empty value means the block is incomplete. */
	stateId: string | undefined;
	condition?: VisualExpression;
}

/**
 * Mutates a story state by assigning a computed expression: `=` sets it,
 * `+=`/`-=` add/subtract a number. An empty variableId means the block is
 * incomplete.
 */
export interface VisualSetBlock {
	kind: 'set';
	id: string;
	/** Story state being mutated. An empty value means the block is incomplete. */
	variableId: string;
	operation: '=' | '+=' | '-=';
	value: VisualExpression;
	condition?: VisualExpression;
}

/**
 * A verbatim SugarCube escape hatch: the sugar is emitted as-is (the
 * expression-boundary escape for anything the visual model cannot express).
 */
export interface VisualRawBlock {
	kind: 'raw';
	id: string;
	/** Raw SugarCube source. An empty value means the block is incomplete. */
	sugar: string;
	condition?: VisualExpression;
}

export interface VisualIncludeBlock {
	kind: 'include';
	id: string;
	/** Target passage ID. An empty value means the block is incomplete. */
	targetPassageId: string;
	condition?: VisualExpression;
}

export interface VisualBranchBlock {
	kind: 'branch';
	id: string;
	branches: VisualBranch[]; // >= 2
}

export interface VisualBranch {
	id: string;
	condition?: VisualExpression; // undefined means the 'else' branch: must be last and unique
	blocks: VisualBlock[];
}

/**
 * A multi-way branch on a state value: the first case whose value equals the
 * state's current value runs; when no case matches, defaultBlocks run.
 */
export interface VisualSwitchBlock {
	kind: 'switch';
	id: string;
	/** Story state switched on. An empty value means the block is incomplete. */
	stateId: string;
	cases: VisualSwitchCase[];
	/** Blocks run when no case value matches. */
	defaultBlocks: VisualBlock[];
	condition?: VisualExpression;
}

export interface VisualSwitchCase {
	id: string;
	/** The value the state must equal for this case to run. */
	value: boolean | number | string;
	blocks: VisualBlock[];
}

/**
 * Iterates a list state, rendering the nested body once per item with `_item`
 * bound to the current item.
 */
export interface VisualLoopBlock {
	kind: 'loop';
	id: string;
	/** List state iterated over. An empty value means the block is incomplete. */
	stateId: string;
	blocks: VisualBlock[];
	condition?: VisualExpression;
}

export type VisualStateType = 'boolean' | 'number' | 'text' | 'list';

export interface VisualStoryState {
	// List states store plain text items.
	defaultValue: boolean | number | string | string[];
	id: string;
	name: string;
	type: VisualStateType;
}

export interface VisualStoryContentV1 {
	states: VisualStoryState[];
	version: 1;
}

export type VisualBinaryOperator =
	| '=='
	| '!='
	| '>'
	| '>='
	| '<'
	| '<='
	| '&&'
	| '||'
	| '+'
	| '-'
	| 'includes'
	| 'notIncludes';

export type VisualExpression =
	| {kind: 'literal'; value: boolean | number | string}
	| {kind: 'variable'; variableId: string}
	| {kind: 'loopItem'}
	| {kind: 'unary'; operator: '!'; operand: VisualExpression}
	| {
			kind: 'binary';
			operator: VisualBinaryOperator;
			left: VisualExpression;
			right: VisualExpression;
	  }
	| {kind: 'free'; code: string};

export interface VisualStateAction {
	operation: 'set' | 'increase' | 'decrease' | 'push' | 'remove' | 'clear';
	stateId: string;
	value: boolean | number | string;
}

export interface Story {
	/**
	 * IFID of the story. An IFID should stay stable when a story is imported or exported.
	 */
	ifid: string;
	/**
	 * GUID identifying the story.
	 */
	id: string;
	/**
	 * When the story was last changed.
	 */
	lastUpdate: Date;
	/**
	 * Name of the story.
	 */
	name: string;
	/**
	 * Passages in the story.
	 */
	passages: Passage[];
	/**
	 * Author-created JavaScript associated with the story.
	 */
	script: string;
	/**
	 * Is the story currently selected by the user?
	 */
	selected: boolean;
	/**
	 * Should passages snap to a grid?
	 */
	snapToGrid: boolean;
	/**
	 * ID of the passage that the story begins at.
	 */
	startPassage: string;
	/**
	 * Name of the story format the story uses.
	 */
	storyFormat: string;
	/**
	 * Version of the story format that this story uses.
	 */
	storyFormatVersion: string;
	/**
	 * Author-created CSS associated with the story.
	 */
	stylesheet: string;
	/**
	 * Tags applied to the story.
	 */
	tags: string[];
	/**
	 * Author-specified colors for passage tags.
	 */
	tagColors: TagColors;
	/**
	 * Zoom level the story is displayed at.
	 */
	zoom: number;
	/** Story-level data for visual authoring. */
	visual?: VisualStoryContentV1;
}

export type StoriesState = Story[];

// Action types.

export interface InitStoriesAction {
	type: 'init';
	state: Story[];
}

export interface RepairStoriesAction {
	type: 'repair';
	allFormats: StoryFormat[];
	defaultFormat: StoryFormat;
}

export interface CreateStoryAction {
	type: 'createStory';
	props: Partial<Story>;
}

export interface UpdateStoryAction {
	type: 'updateStory';
	props: Partial<Omit<Story, 'id'>>;
	storyId: string;
}

export interface DeleteStoryAction {
	type: 'deleteStory';
	storyId: string;
}

export interface CreatePassageAction {
	type: 'createPassage';
	props: Partial<Passage>;
	storyId: string;
}

export interface CreatePassagesAction {
	type: 'createPassages';
	props: Partial<Passage>[];
	storyId: string;
}

export interface UpdatePassageAction {
	type: 'updatePassage';
	passageId: string;
	props: Partial<Passage>;
	storyId: string;
}

export interface UpdatePassagesAction {
	type: 'updatePassages';
	passageUpdates: Record<string, Partial<Passage>>;
	storyId: string;
}

export interface DeletePassageAction {
	type: 'deletePassage';
	passageId: string;
	storyId: string;
}

export interface DeletePassagesAction {
	type: 'deletePassages';
	passageIds: string[];
	storyId: string;
}

export type StoriesAction =
	| InitStoriesAction
	| RepairStoriesAction
	| CreateStoryAction
	| UpdateStoryAction
	| DeleteStoryAction
	| CreatePassageAction
	| CreatePassagesAction
	| UpdatePassageAction
	| UpdatePassagesAction
	| DeletePassageAction
	| DeletePassagesAction;

export type StoriesDispatch = React.Dispatch<
	StoriesAction | Thunk<StoriesState, StoriesAction>
>;

export interface StorySearchFlags {
	includePassageNames?: boolean;
	matchCase?: boolean;
	useRegexes?: boolean;
}

export type TagColors = Record<string, Exclude<Color, 'none'>>;

export interface StoriesContextProps {
	dispatch: StoriesDispatch;
	stories: Story[];
}
