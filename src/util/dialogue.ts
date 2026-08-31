import type {VisualCharacterColor} from '../store/stories/stories.types';

export const visualCharacterColors: VisualCharacterColor[] = [
	'blue',
	'coral',
	'teal',
	'purple',
	'amber',
	'green',
	'pink',
	'slate'
];

export interface DialogueCharacterTone {
	solid: string;
	tint: string;
}

/**
 * A restrained, light-theme-safe palette shared by authoring UI and generated
 * dialogue markup. Names remain visible, so colour is never the sole cue.
 */
export const dialogueCharacterTones: Record<
	VisualCharacterColor,
	DialogueCharacterTone
> = {
	blue: {solid: '#3978c5', tint: '#edf4fc'},
	coral: {solid: '#d96355', tint: '#fdf0ee'},
	teal: {solid: '#238b83', tint: '#eaf7f5'},
	purple: {solid: '#7958b5', tint: '#f3effa'},
	amber: {solid: '#a86f12', tint: '#fbf4e7'},
	green: {solid: '#3d854d', tint: '#edf7ef'},
	pink: {solid: '#b44f82', tint: '#faeef4'},
	slate: {solid: '#68717e', tint: '#f1f3f5'}
};

export function dialogueCharacterTone(color: VisualCharacterColor) {
	return dialogueCharacterTones[color];
}

export function nextDialogueCharacterColor(count: number): VisualCharacterColor {
	return visualCharacterColors[count % visualCharacterColors.length];
}
