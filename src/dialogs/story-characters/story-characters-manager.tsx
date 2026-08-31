import {v4 as uuid} from '@lukeed/uuid';
import {IconPencil, IconPlus, IconTrash} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	highlightPassages,
	Story,
	updateStory,
	VisualCharacter,
	VisualCharacterColor,
	VisualPassageContentV2
} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {
	characterUsage,
	CharacterUsage,
	replaceCharacterReferences
} from '../../util/character-usage';
import {
	dialogueCharacterTone,
	nextDialogueCharacterColor,
	visualCharacterColors
} from '../../util/dialogue';
import {compileVisualPassage} from '../../util/visual-passage';
import './story-characters-manager.css';

function ImpactDetails(props: {story: Story; usage: CharacterUsage}) {
	const {story, usage} = props;
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();

	if (usage.passages.length === 0) {
		return <p className="character-impact-empty">{t('dialogs.storyCharacters.unused')}</p>;
	}

	return (
		<div className="character-impact">
			<p>
				{t('dialogs.storyCharacters.impactSummary', {
					groups: usage.participantGroups,
					lines: usage.speakerLines,
					passages: usage.passages.length
				})}
			</p>
			<ul>
				{usage.passages.map(passage => (
					<li key={passage.passageId}>
						<button
							onClick={() => dispatch(highlightPassages(story, [passage.passageId]))}
							type="button"
						>
							{passage.passageName}
						</button>
						<span>
							{t('dialogs.storyCharacters.passageImpact', {
								groups: passage.participantGroups,
								lines: passage.speakerLines
							})}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function ColorPicker(props: {
	onChange: (color: VisualCharacterColor) => void;
	value: VisualCharacterColor;
}) {
	const {t} = useTranslation();

	return (
		<div aria-label={t('dialogs.storyCharacters.color')} className="character-colors" role="group">
			{visualCharacterColors.map(color => (
				<button
					aria-label={t(`dialogs.storyCharacters.colors.${color}`)}
					aria-pressed={props.value === color}
					className={props.value === color ? 'is-selected' : ''}
					key={color}
					onClick={() => props.onChange(color)}
					style={{'--character-color': dialogueCharacterTone(color).solid} as React.CSSProperties}
					type="button"
				/>
			))}
		</div>
	);
}

export const StoryCharactersManager: React.FC<{story: Story}> = ({story}) => {
	const {dispatch, stories} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const characters = story.visual?.characters ?? [];
	const [adding, setAdding] = React.useState(false);
	const [editingId, setEditingId] = React.useState<string>();
	const [deletingId, setDeletingId] = React.useState<string>();
	const [draftName, setDraftName] = React.useState('');
	const [draftColor, setDraftColor] = React.useState<VisualCharacterColor>('blue');
	const [replacementId, setReplacementId] = React.useState('');

	function nameError(name: string, ignoredId?: string) {
		const normalized = name.trim().toLocaleLowerCase();

		if (!normalized) {
			return t('dialogs.storyCharacters.nameRequired');
		}
		if (
			characters.some(
				character =>
					character.id !== ignoredId &&
					character.name.trim().toLocaleLowerCase() === normalized
			)
		) {
			return t('dialogs.storyCharacters.nameConflict');
		}
		return '';
	}

	function saveStory(
		nextCharacters: VisualCharacter[],
		transform?: (content: VisualPassageContentV2) => VisualPassageContentV2
	) {
		const visual = {
			characters: nextCharacters,
			states: story.visual?.states ?? [],
			version: 1 as const
		};
		const draftPassages = story.passages.map(passage =>
			passage.visual?.version === 2 && transform
				? {...passage, visual: transform(passage.visual)}
				: passage
		);
		const draftStory = {...story, passages: draftPassages, visual};
		const passages = draftPassages.map(passage =>
			passage.visual
				? {
						...passage,
						text: compileVisualPassage(passage.visual, draftStory, passage.id)
					}
				: passage
		);

		dispatch(
			updateStory(stories, story, {passages, visual}),
			'undoChange.editCharacters'
		);
	}

	function beginAdd() {
		setAdding(true);
		setEditingId(undefined);
		setDeletingId(undefined);
		setDraftName('');
		setDraftColor(nextDialogueCharacterColor(characters.length));
	}

	function beginEdit(character: VisualCharacter) {
		setAdding(false);
		setDeletingId(undefined);
		setEditingId(character.id);
		setDraftName(character.name);
		setDraftColor(character.color);
	}

	function beginDelete(character: VisualCharacter) {
		setAdding(false);
		setEditingId(undefined);
		setDeletingId(character.id);
		setReplacementId('');
	}

	function confirmAdd() {
		if (nameError(draftName)) {
			return;
		}
		saveStory([
			...characters,
			{id: uuid(), name: draftName.trim(), color: draftColor}
		]);
		setAdding(false);
	}

	function confirmEdit(character: VisualCharacter) {
		if (nameError(draftName, character.id)) {
			return;
		}
		saveStory(
			characters.map(item =>
				item.id === character.id
					? {...item, name: draftName.trim(), color: draftColor}
					: item
			)
		);
		setEditingId(undefined);
	}

	function confirmDelete(character: VisualCharacter, usage: CharacterUsage) {
		if (usage.speakerLines > 0 && !replacementId) {
			return;
		}
		saveStory(
			characters.filter(item => item.id !== character.id),
			content =>
				replaceCharacterReferences(
					content,
					character.id,
					usage.speakerLines > 0 ? replacementId : undefined
				)
		);
		setDeletingId(undefined);
		setReplacementId('');
	}

	return (
		<div className="story-characters-manager">
			<div className="character-library-heading">
				<div>
					<h3>{t('dialogs.storyCharacters.heading')}</h3>
					<p>{t('dialogs.storyCharacters.hint')}</p>
				</div>
				<button onClick={beginAdd} type="button"><IconPlus />{t('dialogs.storyCharacters.add')}</button>
			</div>

			{adding && (
				<section className="character-edit-panel">
					<label>{t('dialogs.storyCharacters.name')}<input autoFocus onChange={event => setDraftName(event.target.value)} value={draftName} /></label>
					<ColorPicker onChange={setDraftColor} value={draftColor} />
					{nameError(draftName) && <p className="character-error">{nameError(draftName)}</p>}
					<div className="character-panel-actions">
						<button onClick={() => setAdding(false)} type="button">{t('common.cancel')}</button>
						<button disabled={Boolean(nameError(draftName))} onClick={confirmAdd} type="button">{t('common.add')}</button>
					</div>
				</section>
			)}

			{characters.length === 0 && !adding && <p className="character-library-empty">{t('dialogs.storyCharacters.empty')}</p>}
			<div className="character-list">
				{characters.map(character => {
					const usage = characterUsage(story, character.id);
					const editing = editingId === character.id;
					const deleting = deletingId === character.id;
					const renamed = editing && draftName.trim() !== character.name;

					return (
						<section className="character-row" key={character.id}>
							<div className="character-summary">
								<span className="character-dot" style={{'--character-color': dialogueCharacterTone(character.color).solid} as React.CSSProperties} />
								<div><strong>{character.name}</strong><span>{t('dialogs.storyCharacters.rowUsage', {groups: usage.participantGroups, lines: usage.speakerLines, passages: usage.passages.length})}</span></div>
								<button aria-label={t('common.edit')} onClick={() => beginEdit(character)} type="button"><IconPencil /></button>
								<button aria-label={t('common.delete')} onClick={() => beginDelete(character)} type="button"><IconTrash /></button>
							</div>

							{editing && (
								<div className="character-edit-panel is-nested">
									<label>{t('dialogs.storyCharacters.name')}<input autoFocus onChange={event => setDraftName(event.target.value)} value={draftName} /></label>
									<ColorPicker onChange={setDraftColor} value={draftColor} />
									{renamed && <><h4>{t('dialogs.storyCharacters.renameImpact')}</h4><ImpactDetails story={story} usage={usage} /></>}
									{nameError(draftName, character.id) && <p className="character-error">{nameError(draftName, character.id)}</p>}
						<div className="character-panel-actions"><button onClick={() => setEditingId(undefined)} type="button">{t('common.cancel')}</button><button disabled={Boolean(nameError(draftName, character.id))} onClick={() => confirmEdit(character)} type="button">{t('common.ok')}</button></div>
								</div>
							)}

							{deleting && (
								<div className="character-delete-panel">
									<h4>{t('dialogs.storyCharacters.deleteTitle', {name: character.name})}</h4>
									<ImpactDetails story={story} usage={usage} />
									{usage.speakerLines > 0 && (
										<label>{t('dialogs.storyCharacters.replacement')}<select onChange={event => setReplacementId(event.target.value)} value={replacementId}><option value="">{t('dialogs.storyCharacters.chooseReplacement')}</option>{characters.filter(item => item.id !== character.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
									)}
									{usage.speakerLines > 0 && characters.length === 1 && <p className="character-error">{t('dialogs.storyCharacters.cannotDeleteOnlySpeaker')}</p>}
									<div className="character-panel-actions"><button onClick={() => setDeletingId(undefined)} type="button">{t('common.cancel')}</button><button className="danger" disabled={usage.speakerLines > 0 && !replacementId} onClick={() => confirmDelete(character, usage)} type="button">{usage.speakerLines > 0 ? t('dialogs.storyCharacters.replaceAndDelete') : t('common.delete')}</button></div>
								</div>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
};
