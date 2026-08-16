import classNames from 'classnames';
import {deviceType} from 'detect-it';
import * as React from 'react';
import {DraggableCore, DraggableCoreProps} from 'react-draggable';
import {useTranslation} from 'react-i18next';
import {CardContent} from '../container/card';
import {SelectableCard} from '../container/card/selectable-card';
import {Passage, TagColors, VisualBlock, VisualPassageContent} from '../../store/stories';
import {TagStripe} from '../tag/tag-stripe';
import {passageIsEmpty} from '../../util/passage-is-empty';
import {specialPassageMeta} from '../../util/special-passages';
import {migrateVisualContent} from '../../util/visual-passage';
import './passage-card.css';
import { TagBadges } from '../tag/tag-badges';

export interface PassageCardProps {
	onEdit: (passage: Passage) => void;
	onDeselect: (passage: Passage) => void;
	onDragStart?: DraggableCoreProps['onStart'];
	onDrag?: DraggableCoreProps['onDrag'];
	onDragStop?: DraggableCoreProps['onStop'];
	onSelect: (passage: Passage, exclusive: boolean) => void;
	passage: Passage;
	tagColors: TagColors;
	tagDisplay: 'color' | 'name';
}

// Needs to fill a large-sized passage card.
const excerptLength = 400;

/**
 * Returns the text of the first non-empty text block in a visual passage's
 * block tree, in block order (recurring into branches). Returns '' if there
 * is no such block.
 */
function visualPassageExcerpt(visual: VisualPassageContent): string {
	const content = migrateVisualContent(visual);

	function firstText(blocks: VisualBlock[]): string {
		for (const block of blocks) {
			// Raw blocks hold SugarCube source, not passage summary text: they
			// are skipped like every other non-text block.
			if (block.kind === 'text' && block.text !== '') {
				return block.text;
			}

			if (block.kind === 'branch') {
				for (const branch of block.branches) {
					const found = firstText(branch.blocks);

					if (found !== '') {
						return found;
					}
				}
			}

			// Switch and loop blocks contain nested block lists: walk them in
			// block order like branches so their text can be excerpted.
			if (block.kind === 'switch') {
				for (const caseItem of block.cases) {
					const found = firstText(caseItem.blocks);

					if (found !== '') {
						return found;
					}
				}

				const found = firstText(block.defaultBlocks);

				if (found !== '') {
					return found;
				}
			}

			if (block.kind === 'loop') {
				const found = firstText(block.blocks);

				if (found !== '') {
					return found;
				}
			}
		}

		return '';
	}

	return firstText(content.blocks);
}

export const PassageCard: React.FC<PassageCardProps> = React.memo(props => {
	const {
		onDeselect,
		onDrag,
		onDragStart,
		onDragStop,
		onEdit,
		onSelect,
		passage,
		tagColors,
		tagDisplay
	} = props;
	const {t} = useTranslation();
	const className = React.useMemo(
		() =>
			classNames('passage-card', {
				empty: passageIsEmpty(passage),
				selected: passage.selected,
				[`tag-display-${tagDisplay}`]: true
			}),
		[passage, tagDisplay]
	);
	const container = React.useRef<HTMLDivElement>(null);
	const excerpt = React.useMemo(() => {
		const displayText = passage.visual
			? visualPassageExcerpt(passage.visual)
			: passage.text;

		if (displayText.length > 0) {
			return displayText.substring(0, excerptLength);
		}

		return (
			<span className="placeholder">
				{t(
					deviceType === 'touchOnly'
						? 'components.passageCard.placeholderTouch'
						: 'components.passageCard.placeholderClick'
				)}
			</span>
		);
	}, [passage.text, passage.visual, t]);
	const style = React.useMemo(
		() => ({
			height: passage.height,
			left: passage.left,
			top: passage.top,
			width: passage.width
		}),
		[passage.height, passage.left, passage.top, passage.width]
	);
	const specialMeta = React.useMemo(
		() => specialPassageMeta(passage.name),
		[passage.name]
	);
	const handleMouseDown = React.useCallback(
		(event: MouseEvent) => {
			// Shift- or control-clicking toggles our selected status, but doesn't
			// affect any other passage's selected status. If the shift or control key
			// was not held down and we were not already selected, we know the user
			// wants to select only this passage.

			if (event.shiftKey || event.ctrlKey) {
				if (passage.selected) {
					onDeselect(passage);
				} else {
					onSelect(passage, false);
				}
			} else if (!passage.selected) {
				onSelect(passage, true);
			}
		},
		[onDeselect, onSelect, passage]
	);
	const handleEdit = React.useCallback(
		() => onEdit(passage),
		[onEdit, passage]
	);
	const handleSelect = React.useCallback(
		(value: boolean, exclusive: boolean) => {
			onSelect(passage, exclusive);
		},
		[onSelect, passage]
	);

	return (
		<DraggableCore
			nodeRef={container}
			onMouseDown={handleMouseDown}
			onStart={onDragStart}
			onDrag={onDrag}
			onStop={onDragStop}
		>
			<div className={className} ref={container} style={style} data-passage-tags={passage.tags.join(' ')}>
				<SelectableCard
					highlighted={passage.highlighted}
					label={passage.name}
					onDoubleClick={handleEdit}
					onSelect={handleSelect}
					selected={passage.selected}
				>
					{tagDisplay === 'color' && <TagStripe tagColors={tagColors} tags={passage.tags} />}
					<h2>
						{specialMeta && (
							<span className="special-passage-badge">
								{t(specialMeta.labelKey)}
							</span>
						)}
						{passage.name}
					</h2>
					<CardContent>{excerpt}</CardContent>
					{tagDisplay === 'name' && <TagBadges tagColors={tagColors} tags={passage.tags} />}
				</SelectableCard>
			</div>
		</DraggableCore>
	);
});

PassageCard.displayName = 'PassageCard';
