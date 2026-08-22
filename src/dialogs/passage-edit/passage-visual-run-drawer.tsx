import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	BACKPACK_STATE_NAME,
	Passage,
	Story,
	VisualStoryState
} from '../../store/stories';
import {formatWithNameAndVersion, useStoryFormatsContext} from '../../store/story-formats';
import {sanitizeVariableName} from '../../util/visual-passage';
import {buildTestHtml} from '../../util/test-run';
import {StateValueInput} from '../story-states';
import './passage-visual-run-drawer.css';

/** A state value the runtime drawer feeds into the test document. */
type SimulatedValue = boolean | number | string | string[];

/** A single recorded trace entry from the test runtime. */
export interface TraceEntry {
	b?: string;
	c?: string;
	ev?: 's' | 'e';
	r?: boolean;
}

export interface RunResult {
	before: Record<string, SimulatedValue>;
	after: Record<string, SimulatedValue>;
	html: string;
	trace: TraceEntry[];
}

type Tab = 'state' | 'render' | 'trace' | 'sugar';

/** Maps a block id to a human-readable kind label for the trace list. */
export type TraceBlockIdMap = Record<
	string,
	{kindLabel: string; shortId: string}
>;

export const narrativeTestResultType = 'narrative-test-result';
export const narrativeTestErrorType = 'narrative-test-error';

export interface PassageVisualRunDrawerProps {
	passage: Passage & {visual: NonNullable<Passage['visual']>};
	simulatedValues: Record<string, SimulatedValue>;
	story: Story;
	states: VisualStoryState[];
	onSimulatedValuesChange: (values: Record<string, SimulatedValue>) => void;
	onSelectBlock: (blockId?: string) => void;
	selectedBlockId?: string;
	blockLabelMap: TraceBlockIdMap;
	compiledSource: string;
}

export interface ListQuantityChange {
	after: number;
	before: number;
	item: string;
}

/** Converts duplicate-item lists into stable per-item quantity changes. */
export function listQuantityChanges(
	before: string[],
	after: string[]
): ListQuantityChange[] {
	const beforeCounts = new Map<string, number>();
	const afterCounts = new Map<string, number>();

	before.forEach(item => beforeCounts.set(item, (beforeCounts.get(item) ?? 0) + 1));
	after.forEach(item => afterCounts.set(item, (afterCounts.get(item) ?? 0) + 1));

	return [...new Set([...beforeCounts.keys(), ...afterCounts.keys()])]
		.map(item => ({
			after: afterCounts.get(item) ?? 0,
			before: beforeCounts.get(item) ?? 0,
			item
		}))
		.filter(change => change.before !== change.after);
}

interface RuntimeDomainChangesProps {
	result: RunResult;
	states: VisualStoryState[];
}

const RuntimeDomainChanges: React.FC<RuntimeDomainChangesProps> = props => {
	const {result, states} = props;
	const {t} = useTranslation();
	const day = states.find(state => state.name === 'day');
	const period = states.find(state => state.name === 'period');
	const backpack = states.find(state => state.name === BACKPACK_STATE_NAME);
	const dayName = day ? variableNameFor(day.name) : undefined;
	const periodName = period ? variableNameFor(period.name) : undefined;
	const backpackName = backpack ? variableNameFor(backpack.name) : undefined;
	const beforeDay = dayName ? result.before[dayName] : undefined;
	const afterDay = dayName ? result.after[dayName] : undefined;
	const beforePeriod = periodName ? result.before[periodName] : undefined;
	const afterPeriod = periodName ? result.after[periodName] : undefined;
	const beforeItems = backpackName ? result.before[backpackName] : undefined;
	const afterItems = backpackName ? result.after[backpackName] : undefined;
	const timeChanged =
		typeof beforeDay === 'number' &&
		typeof afterDay === 'number' &&
		typeof beforePeriod === 'number' &&
		typeof afterPeriod === 'number' &&
		(beforeDay !== afterDay || beforePeriod !== afterPeriod);
	const itemChanges =
		Array.isArray(beforeItems) && Array.isArray(afterItems)
			? listQuantityChanges(beforeItems, afterItems)
			: [];

	if (!timeChanged && itemChanges.length === 0) {
		return null;
	}

	function timeText(day: number, period: number) {
		return t('dialogs.passageEdit.visual.runtimeTimeMoment', {
			day,
			period: t(`dialogs.passageEdit.visual.timePeriods.${period}`)
		});
	}

	return (
		<div className="run-domain-changes">
			{timeChanged && (
				<article className="run-domain-change run-domain-time">
					<strong>{t('dialogs.passageEdit.visual.runtimeTimeChange')}</strong>
					<span>
						{timeText(beforeDay as number, beforePeriod as number)} →{' '}
						{timeText(afterDay as number, afterPeriod as number)}
					</span>
				</article>
			)}
			{itemChanges.length > 0 && (
				<article className="run-domain-change run-domain-backpack">
					<strong>{t('dialogs.passageEdit.visual.runtimeBackpackChange')}</strong>
					<div className="run-quantity-list">
						{itemChanges.map(change => (
							<span key={change.item}>
								{change.item}: {change.before} → {change.after}
							</span>
						))}
					</div>
				</article>
			)}
		</div>
	);
};

/**
 * The 运行检查 drawer. It keeps the same type-aware value editors as the old
 * simulator (the default test-state snapshot), a 运行 button that publishes a
 * test document into a hidden sandboxed iframe, and four tabs:
 *
 * 状态 / 渲染结果 / 执行记录 / SugarCube.
 *
 * Everything is driven by the compiled story, not a reimplementation:
 * buildTestHtml publishes the story through the same pipeline Play uses, the
 * injected harness posts the rendered output and the execution trace back, and
 * this drawer turns them into per-variable diffs, trimmed HTML, and a
 * clickable trace list.
 */
export const PassageVisualRunDrawer: React.FC<
	PassageVisualRunDrawerProps
> = props => {
	const {
		passage,
		simulatedValues,
		story,
		states,
		onSimulatedValuesChange,
		onSelectBlock,
		selectedBlockId,
		blockLabelMap,
		compiledSource
	} = props;
	const {t} = useTranslation();
	const {formats} = useStoryFormatsContext();
	const [tab, setTab] = React.useState<Tab>('state');
	const [running, setRunning] = React.useState(false);
	const [result, setResult] = React.useState<RunResult | undefined>(undefined);
	const [error, setError] = React.useState<string | undefined>(undefined);
	const iframeRef = React.useRef<HTMLIFrameElement>(null);

	// Handle results posted by the sandboxed test runtime.
	React.useEffect(() => {
		function onMessage(event: MessageEvent) {
			const data = event.data as Record<string, unknown> | undefined;

			if (!data || typeof data !== 'object') {
				return;
			}

			if (data.type === narrativeTestResultType) {
				setResult({
					before: (data.before as Record<string, SimulatedValue>) ?? {},
					after: (data.after as Record<string, SimulatedValue>) ?? {},
					html: String(data.html ?? ''),
					trace: (data.trace as TraceEntry[]) ?? []
				});
				setError(undefined);
			} else if (data.type === narrativeTestErrorType) {
				setError(
					String(
						data.message ??
							t('dialogs.passageEdit.visual.runtimeError')
					)
				);
			}

			setRunning(false);
		}

		window.addEventListener('message', onMessage);

		return () => window.removeEventListener('message', onMessage);
	}, [t]);

	function run() {
		setResult(undefined);
		setError(undefined);
		setRunning(true);

		try {
			const storyFormat = formatWithNameAndVersion(
				formats,
				story.storyFormat,
				story.storyFormatVersion
			);

			if (storyFormat?.loadState !== 'loaded') {
				setError(t('dialogs.passageEdit.visual.formatNotLoaded'));
				setRunning(false);
				return;
			}

			const html = buildTestHtml(
				story,
				passage.id,
				simulatedValues,
				storyFormat.properties.source
			);

			if (iframeRef.current) {
				iframeRef.current.srcdoc = html;
			}
		} catch (err) {
			setError(
				String(
					(err as Error)?.message ??
						err ??
						t('dialogs.passageEdit.visual.runtimeError')
				)
			);
			setRunning(false);
		}
	}

	const tabs: [Tab, string][] = [
		['state', 'dialogs.passageEdit.visual.runTabState'],
		['render', 'dialogs.passageEdit.visual.runTabRender'],
		['trace', 'dialogs.passageEdit.visual.runTabTrace'],
		['sugar', 'dialogs.passageEdit.visual.runTabSugar']
	];

	return (
		<div className="run-drawer">
			<div className="run-drawer-toolbar">
				<button
					data-testid="run-check-button"
					disabled={running}
					onClick={run}
					type="button"
				>
					{running
						? t('dialogs.passageEdit.visual.running')
						: t('dialogs.passageEdit.visual.runButton')}
				</button>
				{error && (
					<span className="run-error" role="alert">
						{t('dialogs.passageEdit.visual.runtimeError')}: {error}
					</span>
				)}
			</div>

			<div className="run-drawer-tabs" role="tablist">
				{tabs.map(([key, labelKey]) => (
					<button
						className={tab === key ? 'is-active' : undefined}
						key={key}
						onClick={() => setTab(key)}
						role="tab"
						type="button"
					>
						{t(labelKey)}
					</button>
				))}
			</div>

			{tab === 'state' && (
				<div className="run-state">
					{result && (
						<RuntimeDomainChanges result={result} states={states} />
					)}
					{states.length === 0 && (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.noStatesHint')}
						</p>
					)}
					{states.map(state => {
						const value =
							simulatedValues[state.id] ?? state.defaultValue;
						const name = variableNameFor(state.name);
						const before = result?.before[name];
						const after = result?.after[name];
						const diff =
							before !== undefined && after !== undefined
								? stateDiffText(before, after)
								: undefined;

						return (
							<div className="simulator-row run-state-row" key={state.id}>
								<div className="simulator-state">
									<span className="simulator-state-name">
										{state.name}
									</span>
									{diff !== undefined && (
										<span
											className={
												diff === null
													? 'run-diff run-diff-unchanged'
													: 'run-diff'
											}
										>
											{diff === null
												? t(
														'dialogs.passageEdit.visual.unchanged'
													)
												: diff}
										</span>
									)}
								</div>
								{state.type === 'list' ? (
									<input
										aria-label={t(
											'dialogs.passageEdit.visual.simulatorValue',
											{name: state.name}
										)}
										onChange={event => {
											const raw = event.target.value;
											const items =
												raw === ''
													? []
													: raw
															.split(',')
															.map(item => item.trim())
															.filter(item => item !== '');
											onSimulatedValuesChange({
												...simulatedValues,
												[state.id]: items
											});
										}}
										value={
											Array.isArray(value)
												? value.join(', ')
												: ''
										}
									/>
								) : (
									<StateValueInput
										label={t(
											'dialogs.passageEdit.visual.simulatorValue',
											{name: state.name}
										)}
										onChange={value =>
											onSimulatedValuesChange({
												...simulatedValues,
												[state.id]: value
											})
										}
										state={state}
										value={value as boolean | number | string}
									/>
								)}
							</div>
						);
					})}
				</div>
			)}

			{tab === 'render' && (
				<div className="run-render">
					{!result ? (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.runHint')}
						</p>
					) : (
						<div
							className="run-render-html"
							dangerouslySetInnerHTML={{
								__html: result.html.replace(
									/<script\b[^>]*>[\s\S]*?<\/script>/gi,
									''
								)
							}}
						/>
					)}
				</div>
			)}

			{tab === 'trace' && (
				<div className="run-trace">
					{!result || result.trace.length === 0 ? (
						<p className="empty-state">
							{t('dialogs.passageEdit.visual.runHint')}
						</p>
					) : (
						<ol className="run-trace-list">
							{result.trace.map((entry, index) => {
								const blockId = entry.b ?? entry.c;

								return (
									<li
										className={
											blockId
												? 'run-trace-entry run-trace-clickable'
												: 'run-trace-entry'
										}
										key={`${index}-${blockId ?? 'cond'}-${entry.ev ?? 'c'}`}
										onClick={() => {
											if (blockId) {
												onSelectBlock(
													selectedBlockId === blockId
														? undefined
														: blockId
												);
											}
										}}
									>
										{entry.ev ? (
											<>
												<span className="run-trace-ev">
													{entry.ev === 's'
														? t(
																'dialogs.passageEdit.visual.traceBlockStart'
															)
														: t(
																'dialogs.passageEdit.visual.traceBlockEnd'
															)}
												</span>
												{blockEntryLabel(blockId, blockLabelMap)}
											</>
										) : (
											<>
												<span className="run-trace-ev">
													{t(
														'dialogs.passageEdit.visual.traceCondition'
													)}
												</span>
												{blockEntryLabel(blockId, blockLabelMap)}
												{' · '}
												<strong>
													{String(Boolean(entry.r))}
												</strong>
											</>
										)}
									</li>
								);
							})}
						</ol>
					)}
				</div>
			)}

			{tab === 'sugar' && (
				<pre className="run-sugar-source">
					{compiledSource === ''
						? t('dialogs.passageEdit.visual.unableToDetermine')
						: compiledSource}
				</pre>
			)}

			<iframe
				data-testid="run-frame"
				ref={iframeRef}
				sandbox="allow-scripts allow-same-origin"
				style={{
					height: 600,
					left: -9999,
					position: 'absolute',
					top: 0,
					width: 800
				}}
				title={t('dialogs.passageEdit.visual.runFrameTitle')}
			/>
		</div>
	);
};

/** The sanitized variable name SugarCube uses for the story state. */
const variableNameFor = (name: string) => sanitizeVariableName(name);

/** Returns a "before -> after" string, or null when unchanged. */
function stateDiffText(
	before: SimulatedValue,
	after: SimulatedValue
): string | null {
	if (Array.isArray(before) || Array.isArray(after)) {
		return String(before) === String(after)
			? null
			: `${String(before)} -> ${String(after)}`;
	}

	return before === after ? null : `${String(before)} -> ${String(after)}`;
}

function blockEntryLabel(
	blockId: string | undefined,
	labelMap: TraceBlockIdMap
) {
	if (!blockId) {
		return <span className="run-trace-unknown">—</span>;
	}

	const entry = labelMap[blockId];

	return (
		<span className={entry ? 'run-trace-block' : 'run-trace-unknown'}>
			{entry ? `${entry.kindLabel} ` : ''}
			{entry ? <code>{entry.shortId}</code> : blockId.slice(0, 8)}
		</span>
	);
}

