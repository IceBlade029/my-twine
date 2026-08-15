import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {CardContent} from '../../components/container/card';
import {DialogCard} from '../../components/container/dialog-card';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {DialogComponentProps} from '../dialogs.types';
import {StoryStatesManager} from './story-states-manager';

export interface StoryStatesDialogProps extends DialogComponentProps {
	storyId: string;
}

export const StoryStatesDialog: React.FC<StoryStatesDialogProps> = props => {
	const {storyId, ...managementProps} = props;
	const {stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const story = stories.find(item => item.id === storyId);

	// The story may have been deleted while the dialog was open; render nothing.

	if (!story) {
		return null;
	}

	return (
		<DialogCard
			className="story-states-dialog"
			fixedSize
			headerLabel={t('dialogs.storyStates.title')}
			{...managementProps}
		>
			<CardContent>
				<StoryStatesManager story={story} />
			</CardContent>
		</DialogCard>
	);
};
