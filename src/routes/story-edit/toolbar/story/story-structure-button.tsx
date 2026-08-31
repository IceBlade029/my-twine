import {IconSettings} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../../components/control/icon-button';
import {StoryStructureDialog, useDialogsContext} from '../../../../dialogs';
import {Story} from '../../../../store/stories';

export interface StoryStructureButtonProps {
	story: Story;
}

export const StoryStructureButton: React.FC<StoryStructureButtonProps> = ({
	story
}) => {
	const {dispatch} = useDialogsContext();
	const {t} = useTranslation();

	return (
		<IconButton
			icon={<IconSettings />}
			label={t('routes.storyEdit.toolbar.storyStructure')}
			onClick={() =>
				dispatch({
					type: 'addDialog',
					component: StoryStructureDialog,
					presentation: 'modal',
					modalSize: 'wide',
					props: {storyId: story.id}
				})
			}
		/>
	);
};
