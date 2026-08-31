import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {CardContent} from '../../components/container/card';
import {DialogCard} from '../../components/container/dialog-card';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {DialogComponentProps} from '../dialogs.types';
import {StoryCharactersManager} from './story-characters-manager';

export interface StoryCharactersDialogProps extends DialogComponentProps {
	storyId: string;
}

export const StoryCharactersDialog: React.FC<StoryCharactersDialogProps> = props => {
	const {storyId, ...managementProps} = props;
	const {stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const story = stories.find(item => item.id === storyId);

	if (!story) {
		return null;
	}

	return (
		<DialogCard className="story-characters-dialog" fixedSize headerLabel={t('dialogs.storyCharacters.title')} {...managementProps}>
			<CardContent><StoryCharactersManager story={story} /></CardContent>
		</DialogCard>
	);
};
