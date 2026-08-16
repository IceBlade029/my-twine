import {Story} from '../store/stories';
import {publishStory, publishStoryWithFormat} from './publish';
import {getAppInfo} from './app-info';
import {
	compileVisualPassage,
	passageUsesVisualEditor,
	sanitizeVariableName
} from './visual-passage';

/**
 * A single story-state value that the runtime drawer feeds into the built
 * test document. Keys are story-state ids OR sanitized story-state variable
 * names (e.g. `Trust` for the "Trust" state).
 */
export type TestStateValue = boolean | number | string | string[];

function jsObject(value: unknown) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Rewrites the `startnode` attribute of the story's `<tw-storydata>` element
 * to the pid of the passage under test, so SugarCube's `Story.init()` picks it
 * as the starting passage.
 */
function rewriteStartnode(html: string, targetPid: number) {
	return html.replace(/startnode="[^"]*"/, `startnode="${targetPid}"`);
}

/**
 * Builds the standalone HTML document the 运行检查 drawer loads into a hidden
 * sandboxed iframe. It publishes the story the same way the app's Play action
 * does (`publishStory` for the story data), compiles every visual passage in
 * trace mode (so the drawer can highlight executed blocks), points SugarCube's
 * `startnode` at the passage under test, injects the test-state overrides as
 * `<<set>>` macros into StoryInit (or the target passage when StoryInit does
 * not exist), and injects a harness script before `</body>` that:
 *
 *  - records `window.__trace` as blocks execute,
 *  - snapshots the story variables at `:passagestart` ("before"),
 *  - posts `{type:'narrative-test-result', before, after, html, trace}` to the
 *    parent window at `:passageend`,
 *  - surfaces any failure as `{type:'narrative-test-error', message}`.
 *
 * When `formatSource` (the bundled SugarCube engine HTML) is supplied the
 * story is bound to it, producing a real playable runtime. Without one the
 * function still returns a complete document skeleton (used by tests, which
 * only inspect string contents).
 */
export function buildTestHtml(
	story: Story,
	passageId: string,
	stateOverrides: Record<string, TestStateValue>,
	formatSource?: string
): string {
	const appInfo = getAppInfo();
	const targetIndex = story.passages.findIndex(
		passage => passage.id === passageId
	);

	if (targetIndex < 0) {
		throw new Error(`No passage with id "${passageId}" in the story.`);
	}

	// The pid of the passage under test, matching story.passages order (pids
	// are 1-based in publishPassage).
	const targetPid = targetIndex + 1;

	// Clone the story and recompile every visual passage in trace mode so the
	// published `<tw-passagedata>` carries the executed-block markers. The
	// visual data is kept so the narrative-editor metadata still serializes.
	const testStory: Story = {
		...story,
		passages: story.passages.map(passage => {
			if (!passageUsesVisualEditor(passage)) {
				return passage;
			}

			return {
				...passage,
				text: compileVisualPassage(
					passage.visual,
					story,
					passage.id,
					{trace: true}
				)
			};
		})
	};

	// Convert id- or name-keyed overrides to sanitized variable names and
	// inject them as `<<set>>` macros so the test state is in place before the
	// first passage renders.
	const overrideSets = Object.entries(stateOverrides).map(([key, value]) => {
		const state = story.visual?.states?.find(item => item.id === key);

		return {
			name: sanitizeVariableName(state ? state.name : key),
			value
		};
	});

	if (overrideSets.length > 0) {
		const sets = overrideSets
			.map(set => `<<set $${set.name} = ${JSON.stringify(set.value)}>>`)
			.join('\n');
		const initPassage = testStory.passages.find(
			passage => passage.name === 'StoryInit'
		);

		testStory.passages = testStory.passages.map(passage => {
			if (initPassage && passage.name === 'StoryInit') {
				// Prepend so the overrides run before the passage's own blocks
				// (the init block guards itself with <<if ndef>>).
				return {...passage, text: `${sets}\n${passage.text}`};
			}

			if (!initPassage && passage.id === passageId) {
				return {...passage, text: `${sets}\n${passage.text}`};
			}

			return passage;
		});
	}

	const passageNames =
		story.visual?.states?.map(state => sanitizeVariableName(state.name)) ??
		[];

	if (formatSource) {
		// Bind the SugarCube engine and point startnode at the target passage.
		let bound = publishStoryWithFormat(
			testStory,
			formatSource,
			appInfo,
			{startOptional: true}
		);

		bound = rewriteStartnode(bound, targetPid);

		return injectHarness(bound, buildHarness(passageNames));
	}

	// Without a bound engine, still produce a complete document skeleton. The
	// story data is embedded and the harness is injected before </body>.
	const storyData = rewriteStartnode(
		publishStory(testStory, appInfo, {startOptional: true}),
		targetPid
	);
	const skeleton =
		'<!DOCTYPE html>\n' +
		'<html><head><meta charset="utf-8" /></head><body>' +
		storyData +
		'</body></html>';

	return injectHarness(skeleton, buildHarness(passageNames));
}

function buildHarness(passageNames: string[]): string {
	return (
		`<script data-narrative-test-run>\n` +
		`(function () {\n` +
		`\ttry {\n` +
		`\t\twindow.__trace = window.__trace || [];\n` +
		`\t\tvar SC = window.SugarCube;\n` +
		`\t\tvar \u0024 = window.jQuery || window.\u0024;\n` +
		`\t\tvar stateNames = ${jsObject(passageNames)};\n` +
		`\t\tfunction snapshot() {\n` +
		`\t\t\tvar out = {};\n` +
		`\t\t\tif (SC && SC.State && SC.State.variables) {\n` +
		`\t\t\t\tfor (var i = 0; i < stateNames.length; i += 1) {\n` +
		`\t\t\t\t\tvar name = stateNames[i];\n` +
		`\t\t\t\t\tif (Object.prototype.hasOwnProperty.call(SC.State.variables, name)) {\n` +
		`\t\t\t\t\t\tout[name] = SC.State.variables[name];\n` +
		`\t\t\t\t\t}\n` +
		`\t\t\t\t}\n` +
		`\t\t\t}\n` +
		`\t\t\treturn out;\n` +
		`\t\t}\n` +
		`\t\tfunction post(payload) {\n` +
		`\t\t\ttry { window.parent.postMessage(payload, '*'); } catch (e) {}\n` +
		`\t\t}\n` +
		`\t\tif (!\u0024 || !SC || !SC.State) {\n` +
		`\t\t\tpost({type: 'narrative-test-error', message: 'SugarCube runtime is not available (missing jQuery or SugarCube.State).'});\n` +
		`\t\t\treturn;\n` +
		`\t\t}\n` +
		`\t\tvar before = null;\n` +
		`\t\tvar posted = false;\n` +
		`\t\t\u0024(document).on(':passagestart', function () {\n` +
		`\t\t\ttry {\n` +
		`\t\t\t\tif (before === null && !posted) { before = snapshot(); }\n` +
		`\t\t\t} catch (err) {}\n` +
		`\t\t});\n` +
		`\t\t\u0024(document).on(':passageend', function () {\n` +
		`\t\t\tif (posted) { return; }\n` +
		`\t\t\tposted = true;\n` +
		`\t\t\ttry {\n` +
		`\t\t\t\tvar passageEl = document.querySelector('#passages');\n` +
		`\t\t\t\tpost({type: 'narrative-test-result', before: before === null ? snapshot() : before, after: snapshot(), html: passageEl ? passageEl.innerHTML : '', trace: window.__trace || []});\n` +
		`\t\t\t} catch (err) {\n` +
		`\t\t\t\tpost({type: 'narrative-test-error', message: String((err && err.message) || err)});\n` +
		`\t\t\t}\n` +
		`\t\t});\n` +
		`\t} catch (err) {\n` +
		`\t\ttry { window.parent.postMessage({type: 'narrative-test-error', message: String((err && err.message) || err)}, '*'); } catch (e) {}\n` +
		`\t}\n` +
		`})();\n` +
		`</script>`
	);
}

/**
 * Inserts a `<script>` block just before the closing `</body>` of an HTML
 * document, returning the new document string.
 */
function injectHarness(html: string, script: string) {
	const bodyEnd = html.lastIndexOf('</body>');

	if (bodyEnd === -1) {
		return html + script;
	}

	return html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
}
