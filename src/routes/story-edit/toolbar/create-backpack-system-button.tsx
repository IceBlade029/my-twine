import {IconBackpack} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../components/control/icon-button';
import {
	BACKPACK_PASSAGE_NAME,
	createBackpackSystem,
	highlightPassages,
	Story,
	storyHasBackpackSystem,
	useStoriesContext
} from '../../../store/stories';
import {useUndoableStoriesContext} from '../../../store/undoable-stories';

export interface CreateBackpackSystemButtonProps {
	story: Story;
}

export const CreateBackpackSystemButton: React.FC<CreateBackpackSystemButtonProps> = ({
	story
}) => {
	const {stories} = useStoriesContext();
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();

	const handleClick = React.useCallback(() => {
		if (storyHasBackpackSystem(story)) {
			// Already set up: don't duplicate the state; just show where the
			// backpack passage lives.
			const backpack = story.passages.find(
				passage => passage.name === BACKPACK_PASSAGE_NAME
			);

			if (backpack) {
				dispatch(highlightPassages(story, [backpack.id]));
			}

			return;
		}

		dispatch(createBackpackSystem(stories, story), 'undoChange.createBackpackSystem');
	}, [dispatch, stories, story]);

	return (
		<IconButton
			icon={<IconBackpack />}
			label={t('routes.storyEdit.backpackSystemButton.label')}
			onClick={handleClick}
		/>
	);
};