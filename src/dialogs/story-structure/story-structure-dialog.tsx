import {
	IconAlertTriangle,
	IconBackpack,
	IconCheck,
	IconClock,
	IconFileCode,
	IconVariable
} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {CardContent} from '../../components/container/card';
import {DialogCard} from '../../components/container/dialog-card';
import {
	backpackSystemStatus,
	BACKPACK_PASSAGE_NAME,
	createBackpackSystem,
	createSpecialPassage,
	createTimeSystem,
	highlightPassages,
	timeSystemStatus
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	SpecialPassageName,
	specialPassageMeta
} from '../../util/special-passages';
import {addStoryStates, useDialogsContext} from '../context';
import {DialogComponentProps} from '../dialogs.types';
import './story-structure-dialog.css';

export interface StoryStructureDialogProps extends DialogComponentProps {
	storyId: string;
}

interface SpecialPassageSection {
	names: SpecialPassageName[];
	titleKey: string;
}

const specialPassageSections: SpecialPassageSection[] = [
	{
		titleKey: 'dialogs.storyStructure.storyInformation',
		names: [
			'StoryDisplayTitle',
			'StoryAuthor',
			'StorySubtitle',
			'StoryBanner'
		]
	},
	{
		titleKey: 'dialogs.storyStructure.globalInterface',
		names: ['StoryCaption', 'StoryMenu', 'PassageHeader', 'PassageFooter']
	},
	{
		titleKey: 'dialogs.storyStructure.runtimeAdvanced',
		names: ['StoryInit', 'PassageReady', 'PassageDone', 'StoryInterface']
	}
];

/**
 * Story-level home for global systems, variables, and SugarCube runtime
 * passages. Nothing here is owned by the currently selected ordinary Passage.
 */
export const StoryStructureDialog: React.FC<StoryStructureDialogProps> = props => {
	const {storyId, ...managementProps} = props;
	const {dispatch, stories} = useUndoableStoriesContext();
	const {dispatch: dialogDispatch} = useDialogsContext();
	const {t} = useTranslation();
	const story = stories.find(item => item.id === storyId);

	if (!story) {
		return null;
	}

	const time = timeSystemStatus(story);
	const backpack = backpackSystemStatus(story);
	const stateCount = story.visual?.states.length ?? 0;

	function locatePassage(name: string) {
		const passage = story!.passages.find(item => item.name === name);

		if (passage) {
			dispatch(highlightPassages(story!, [passage.id]));
		}
	}

	function systemButton(
		kind: 'time' | 'backpack',
		status: 'missing' | 'incomplete' | 'ready'
	) {
		if (status === 'ready') {
			locatePassage(kind === 'time' ? 'StoryCaption' : BACKPACK_PASSAGE_NAME);
			return;
		}

		dispatch(
			kind === 'time'
				? createTimeSystem(stories, story!)
				: createBackpackSystem(stories, story!),
			kind === 'time'
				? 'undoChange.createTimeSystem'
				: 'undoChange.createBackpackSystem'
		);
	}

	function specialPassageCard(name: SpecialPassageName) {
		const meta = specialPassageMeta(name)!;
		const existing = story!.passages.find(passage => passage.name === name);
		const advanced = name === 'StoryInterface';

		return (
			<article
				className={`story-global-card${advanced ? ' is-advanced' : ''}`}
				key={name}
			>
				<span className="story-global-icon"><IconFileCode /></span>
				<div className="story-global-content">
					<div className="story-global-heading">
						<strong>{t(meta.labelKey)}</strong>
						<code>{name}</code>
					</div>
					<span>{t(meta.descriptionKey)}</span>
					{advanced && (
						<small>{t('dialogs.storyStructure.storyInterfaceWarning')}</small>
					)}
				</div>
				<span className={`story-global-status is-${existing ? 'ready' : 'missing'}`}>
					{existing ? <IconCheck /> : <IconAlertTriangle />}
					{t(
						existing
							? 'dialogs.storyStructure.created'
							: 'dialogs.storyStructure.notCreated'
					)}
				</span>
				<button
					onClick={() => {
						if (existing) {
							locatePassage(name);
						} else {
							dispatch(
								createSpecialPassage(story!, name),
								'undoChange.newPassage'
							);
						}
					}}
					type="button"
				>
					{t(
						existing
							? 'dialogs.storyStructure.locate'
							: 'dialogs.storyStructure.createAndEdit'
					)}
				</button>
			</article>
		);
	}

	return (
		<DialogCard
			className="story-structure-dialog"
			fixedSize
			headerLabel={t('dialogs.storyStructure.title')}
			{...managementProps}
		>
			<CardContent>
				<div className="story-structure-content">
					<p className="story-structure-intro">
						{t('dialogs.storyStructure.intro')}
					</p>

					<section>
						<div className="story-structure-section-heading">
							<div>
								<h3>{t('dialogs.storyStructure.systemsAndCapabilities')}</h3>
								<p>{t('dialogs.storyStructure.systemsHint')}</p>
							</div>
						</div>
						<div className="story-system-grid">
							<article className="story-system-card system-variables">
								<span className="story-system-icon"><IconVariable /></span>
								<div>
									<strong>{t('dialogs.storyStructure.storyVariables')}</strong>
									<span>{t('dialogs.storyStructure.variableCount', {count: stateCount})}</span>
								</div>
								<button
									onClick={() => dialogDispatch(addStoryStates(story.id))}
									type="button"
								>
									{t('dialogs.storyStructure.manage')}
								</button>
							</article>

							<article className={`story-system-card system-time is-${time.state}`}>
								<span className="story-system-icon"><IconClock /></span>
								<div>
									<strong>{t('dialogs.passageEdit.visual.timeSystem')}</strong>
									<span>{t('dialogs.storyStructure.timeSystemSummary')}</span>
								</div>
								<span className="story-system-status">
									{time.state === 'ready' ? <IconCheck /> : <IconAlertTriangle />}
									{t(`dialogs.passageEdit.visual.systemStatus.${time.state}`)}
								</span>
								<button onClick={() => systemButton('time', time.state)} type="button">
									{t(
										time.state === 'ready'
											? 'dialogs.storyStructure.locate'
											: time.state === 'missing'
												? 'dialogs.storyStructure.enable'
												: 'dialogs.storyStructure.repair'
									)}
								</button>
							</article>

							<article className={`story-system-card system-backpack is-${backpack.state}`}>
								<span className="story-system-icon"><IconBackpack /></span>
								<div>
									<strong>{t('dialogs.passageEdit.visual.backpackSystem')}</strong>
									<span>{t('dialogs.storyStructure.backpackSystemSummary')}</span>
								</div>
								<span className="story-system-status">
									{backpack.state === 'ready' ? <IconCheck /> : <IconAlertTriangle />}
									{t(`dialogs.passageEdit.visual.systemStatus.${backpack.state}`)}
								</span>
								<button onClick={() => systemButton('backpack', backpack.state)} type="button">
									{t(
										backpack.state === 'ready'
											? 'dialogs.storyStructure.locate'
											: backpack.state === 'missing'
												? 'dialogs.storyStructure.enable'
												: 'dialogs.storyStructure.repair'
									)}
								</button>
							</article>
						</div>
					</section>

					{specialPassageSections.map(section => (
						<section key={section.titleKey}>
							<div className="story-structure-section-heading">
								<div>
									<h3>{t(section.titleKey)}</h3>
									<p>{t(`${section.titleKey}Hint`)}</p>
								</div>
							</div>
							<div className="story-global-list">
								{section.names.map(specialPassageCard)}
							</div>
						</section>
					))}
				</div>
			</CardContent>
		</DialogCard>
	);
};
