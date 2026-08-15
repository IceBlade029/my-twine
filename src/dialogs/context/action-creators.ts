import {Thunk} from 'react-hook-thunk-reducer';
import {DialogsAction, DialogsState} from '../dialogs.types';
import {PassageEditStack} from '../passage-edit';

/**
 * Adds a passage editor dialog, either creating a new stack for it or adding it
 * to the top of an existing one.
 */
export function addPassageEditors(
	storyId: string,
	passageIds: string[]
): Thunk<DialogsState, DialogsAction> {
	return (dispatch, state) => {
		const currentState = state();
		const passageEditStackIndex = currentState.findIndex(
			({component}) => component === PassageEditStack
		);

		if (passageEditStackIndex !== -1) {
			// Put the passage IDs at the start, ensuring there are no duplicates.

			dispatch({
				type: 'setDialogProps',
				index: passageEditStackIndex,
				props: {
					...currentState[passageEditStackIndex].props,
					passageIds: passageIds.slice(0, 1)
				}
			});
		} else {
			dispatch({
				type: 'addDialog',
				component: PassageEditStack,
				props: {
					storyId,
					passageIds: passageIds.slice(0, 1)
				}
			});
		}
	};
}

export function removePassageEditors(
	passageIds: string[]
): Thunk<DialogsState, DialogsAction> {
	return (dispatch, state) => {
		const currentState = state();
		const passageEditStackIndex = currentState.findIndex(
			({component}) => component === PassageEditStack
		);

		if (passageEditStackIndex === -1) {
			console.warn(
				'Asked to remove a passage editor, but there is no editor stack'
			);
			return;
		}

		const updatedPassageIds = currentState[
			passageEditStackIndex
		].props!.passageIds.filter((id: string) => !passageIds.includes(id));

		if (updatedPassageIds.length === 0) {
			// There are no passages left, so close the stack.
			dispatch({type: 'removeDialog', index: passageEditStackIndex});
		} else {
			dispatch({
				type: 'setDialogProps',
				index: passageEditStackIndex,
				props: {
					...currentState[passageEditStackIndex].props,
					passageIds: updatedPassageIds
				}
			});
		}
	};
}
