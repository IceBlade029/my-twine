import {IconClock} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../components/control/icon-button';
import {
	createTimeSystem,
	highlightPassages,
	Story,
	storyHasTimeSystem,
	useStoriesContext
} from '../../../store/stories';
import {useUndoableStoriesContext} from '../../../store/undoable-stories';

export interface CreateTimeSystemButtonProps {
	story: Story;
}

export const CreateTimeSystemButton: React.FC<CreateTimeSystemButtonProps> = ({
	story
}) => {
	const {stories} = useStoriesContext();
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();

	const handleClick = React.useCallback(() => {
		if (storyHasTimeSystem(story)) {
			// Already set up: don't duplicate the states; just show where the
			// caption lives.
			const caption = story.passages.find(
				passage => passage.name === 'StoryCaption'
			);

			if (caption) {
				dispatch(highlightPassages(story, [caption.id]));
			}

			return;
		}

		dispatch(createTimeSystem(stories, story), 'undoChange.createTimeSystem');
	}, [dispatch, stories, story]);

	return (
		<IconButton
			icon={<IconClock />}
			label={t('routes.storyEdit.timeSystemButton.label')}
			onClick={handleClick}
		/>
	);
};