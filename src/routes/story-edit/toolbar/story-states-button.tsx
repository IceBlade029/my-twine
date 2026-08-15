import {IconVariable} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../components/control/icon-button';
import {addStoryStates, useDialogsContext} from '../../../dialogs/context';
import {Story} from '../../../store/stories';

export interface StoryStatesButtonProps {
	story: Story;
}

export const StoryStatesButton: React.FC<StoryStatesButtonProps> = ({story}) => {
	const {dispatch} = useDialogsContext();
	const {t} = useTranslation();

	return (
		<IconButton
			icon={<IconVariable />}
			label={t('routes.storyEdit.storyStatesButton.label')}
			onClick={() => dispatch(addStoryStates(story.id))}
		/>
	);
};
