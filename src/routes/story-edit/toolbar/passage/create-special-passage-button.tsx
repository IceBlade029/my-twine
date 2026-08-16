import {IconTextPlus} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {MenuButton} from '../../../../components/control/menu-button';
import {
	createSpecialPassage,
	highlightPassages,
	Story
} from '../../../../store/stories';
import {useUndoableStoriesContext} from '../../../../store/undoable-stories';
import {specialPassageMeta, SPECIAL_PASSAGES} from '../../../../util/special-passages';

export interface CreateSpecialPassageButtonProps {
	story: Story;
}

export const CreateSpecialPassageButton: React.FC<
	CreateSpecialPassageButtonProps
> = props => {
	const {story} = props;
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();

	const handleClick = React.useCallback(
		(name: string) => {
			const existing = story.passages.find(
				passage => passage.name === name
			);

			// If a passage with this exact special name already exists, don't
			// create a duplicate; just highlight the existing one instead.
			if (existing) {
				dispatch(highlightPassages(story, [existing.id]));
				return;
			}

			dispatch(createSpecialPassage(story, name), 'undoChange.newPassage');
		},
		[dispatch, story]
	);

	const items = Object.keys(SPECIAL_PASSAGES).map(name => {
		const meta = specialPassageMeta(name)!;

		return {
			label: t('routes.storyEdit.toolbar.newSpecialPassage', {
				label: t(meta.labelKey)
			}),
			onClick: () => handleClick(name)
		};
	});

	return (
		<MenuButton
			icon={<IconTextPlus />}
			items={items}
			label={t('routes.storyEdit.toolbar.newSpecialPassage')}
			variant="primary"
		/>
	);
};
