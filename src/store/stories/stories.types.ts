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
	condition?: VisualCondition;
	actions: VisualStateAction[];
}

export interface VisualPassageContentV1 {
	/** Plain passage body. SugarCube source is generated from this data. */
	body: string;
	bodyCondition?: VisualCondition;
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

export type VisualBlock = VisualTextBlock | VisualChoiceBlock | VisualBranchBlock;

export interface VisualTextBlock {
	kind: 'text';
	id: string;
	text: string;
	condition?: VisualCondition;
}

export interface VisualChoiceBlock {
	kind: 'choice';
	id: string;
	label: string;
	targetPassageId: string; // '' means incomplete
	condition?: VisualCondition;
	actions: VisualStateAction[];
}

export interface VisualBranchBlock {
	kind: 'branch';
	id: string;
	branches: VisualBranch[]; // >= 2
}

export interface VisualBranch {
	id: string;
	condition?: VisualCondition; // undefined means the 'else' branch: must be last and unique
	blocks: VisualBlock[];
}

export type VisualStateType = 'boolean' | 'number' | 'text';

export interface VisualStoryState {
	defaultValue: boolean | number | string;
	id: string;
	name: string;
	type: VisualStateType;
}

export interface VisualStoryContentV1 {
	states: VisualStoryState[];
	version: 1;
}

export interface VisualCondition {
	operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan';
	stateId: string;
	value: boolean | number | string;
}

export interface VisualStateAction {
	operation: 'set' | 'increase' | 'decrease';
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
