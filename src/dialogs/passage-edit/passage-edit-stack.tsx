import classNames from 'classnames';
import * as React from 'react';
import {DialogCard} from '../../components/container/dialog-card';
import {TagGrid} from '../../components/tag';
import {VisibleWhitespace} from '../../components/visible-whitespace';
import {
	passageWithId,
	storyWithId,
	useStoriesContext
} from '../../store/stories';
import {
	removePassageEditors,
	useDialogsContext
} from '../context';
import {DialogComponentProps} from '../dialogs.types';
import {PassageEditContents} from './passage-edit-contents';
import './passage-edit-stack.css';

export interface PassageEditStackProps extends DialogComponentProps {
	passageIds: string[];
	storyId: string;
}

const InnerPassageEditStack: React.FC<PassageEditStackProps> = props => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const {onChangeProps, onClose, passageIds, storyId, ...managementProps} =
		props;
	const {dispatch} = useDialogsContext();
	const {stories} = useStoriesContext();
	const storyTagColors = storyWithId(stories, storyId).tagColors;
	const passage = passageWithId(stories, storyId, passageIds[0]);

	return (
		<div className={classNames('passage-edit-stack')}>
			<DialogCard
				{...managementProps}
				fixedSize
				headerDisplayLabel={
					<>
						<TagGrid tags={passage.tags} tagColors={storyTagColors} />
						<VisibleWhitespace value={passage.name} />
					</>
				}
				headerLabel={passage.name}
				onClose={() => dispatch(removePassageEditors([passage.id]))}
			>
				<PassageEditContents passageId={passage.id} storyId={storyId} />
			</DialogCard>
		</div>
	);
};

export const PassageEditStack: React.FC<PassageEditStackProps> = props => {
	const {passageIds, storyId} = props;
	const {stories} = useStoriesContext();

	const existingPassageIds = passageIds.filter(passageId => {
		try {
			passageWithId(stories, storyId, passageId);
		} catch {
			return false;
		}

		return true;
	});

	// If there aren't any passages to display, render nothing and call onClose.

	if (existingPassageIds.length === 0) {
		props.onClose();
		return null;
	}

	// If passages differ from what we were asked to display, change our props.

	if (existingPassageIds.length !== passageIds.length) {
		props.onChangeProps({...props, passageIds: existingPassageIds});
		return null;
	}

	// We're good to display dialogs normally.

	return <InnerPassageEditStack {...props} />;
};

PassageEditStack.displayName = 'PassageEditStack';
